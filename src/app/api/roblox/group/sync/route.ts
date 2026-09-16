import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesTx, syncState } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { errorOut, getAccountRow, HttpError, robloxFetch } from "@/lib/roblox";
import { sleep } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = ["Sale", "Commissions", "GroupPayout"] as const;
type TxType = (typeof TYPES)[number];

/** Бюджет одного вызова — чтобы ответ гарантированно уложился в таймаут. */
const BUDGET_MS = 22_000;

interface RawTx {
  id?: number;
  /** У групповых транзакций id всегда 0 — настоящий ключ здесь. */
  idHash?: string;
  purchaseToken?: string;
  created: string;
  currency?: { amount?: number };
  details?: { id?: number; name?: string };
  agent?: { name?: string };
}

const txKey = (r: RawTx): string | null =>
  r.idHash || r.purchaseToken || (r.id ? String(r.id) : null);

async function fetchPage(
  cookie: string,
  groupId: string,
  type: string,
  cursor: string | null
): Promise<{ rows: RawTx[]; next: string | null; rateLimited: boolean }> {
  const params = new URLSearchParams({
    limit: "100",
    sortOrder: "Desc",
    transactionType: type,
  });
  if (cursor) params.set("cursor", cursor);
  const res = await robloxFetch(
    cookie,
    `https://economy.roblox.com/v2/groups/${groupId}/transactions?${params}`
  );
  if (res.status === 429) return { rows: [], next: cursor, rateLimited: true };
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(res.status, "Roblox отклонил сессию — обнови куки аккаунта");
    }
    throw new HttpError(res.status, `Roblox вернул ${res.status}`);
  }
  const data = (await res.json()) as { data?: RawTx[]; nextPageCursor?: string | null };
  return { rows: data.data ?? [], next: data.nextPageCursor ?? null, rateLimited: false };
}

async function saveRows(groupId: string, type: string, rows: RawTx[]): Promise<number> {
  const values = rows
    .filter((r) => txKey(r) && r.created)
    .map((r) => ({
      groupId,
      txId: txKey(r) as string,
      type,
      created: new Date(r.created),
      amount: Math.round(r.currency?.amount ?? 0),
      itemId: r.details?.id ? String(r.details.id) : null,
      itemName: r.details?.name ?? null,
      agentName: r.agent?.name ?? null,
    }));
  if (!values.length) return 0;

  let inserted = 0;
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    const res = await db
      .insert(salesTx)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: salesTx.id });
    inserted += res.length;
  }
  return inserted;
}

async function getState(groupId: string, type: string) {
  const rows = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.groupId, groupId), eq(syncState.type, type)))
    .limit(1);
  if (rows[0]) return rows[0];
  const created = await db
    .insert(syncState)
    .values({ groupId, type })
    .onConflictDoNothing()
    .returning();
  if (created[0]) return created[0];
  const again = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.groupId, groupId), eq(syncState.type, type)))
    .limit(1);
  return again[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const account = await getAccountRow(String(body?.account ?? ""));
    const groupId = String(body?.groupId ?? "");
    const type: TxType = TYPES.includes(body?.type) ? body.type : "Sale";
    const targetDays = Math.min(120, Math.max(7, Number(body?.days) || 30));
    if (!groupId) throw new HttpError(400, "groupId?");

    const cookie = account.cookie;
    const started = Date.now();
    const until = new Date(Date.now() - targetDays * 86400000);

    const state = await getState(groupId, type);
    let cursor = state?.cursor ?? null;
    let complete = state?.complete ?? false;
    let oldest = state?.oldestCreated ?? null;

    let added = 0;
    let pages = 0;
    let rateHits = 0;

    // 1) свежие транзакции — всегда с начала списка (дёшево, 1-2 страницы)
    if (!body?.backfillOnly) {
      let freshCursor: string | null = null;
      for (let i = 0; i < 2 && Date.now() - started < BUDGET_MS; i++) {
        const page = await fetchPage(cookie, groupId, type, freshCursor);
        if (page.rateLimited) {
          rateHits++;
          await sleep(2500);
          continue;
        }
        pages++;
        const n = await saveRows(groupId, type, page.rows);
        added += n;
        const last = page.rows.at(-1);
        if (last?.created) {
          const d = new Date(last.created);
          if (!oldest || d < oldest) oldest = d;
        }
        // все записи страницы уже были в базе — свежее ничего нет
        if (n === 0 && i > 0) break;
        if (!page.next) break;
        freshCursor = page.next;
        await sleep(650);
      }
    }

    // 2) докачка вглубь с сохранённого курсора
    while (!complete && Date.now() - started < BUDGET_MS) {
      const page = await fetchPage(cookie, groupId, type, cursor);
      if (page.rateLimited) {
        rateHits++;
        await sleep(2500);
        continue;
      }
      pages++;
      added += await saveRows(groupId, type, page.rows);

      const last = page.rows.at(-1);
      if (last?.created) {
        const d = new Date(last.created);
        if (!oldest || d < oldest) oldest = d;
        if (d <= until) {
          complete = true; // добрались до нужной глубины
        }
      }
      if (!page.next) complete = true;
      cursor = page.next;
      if (complete) break;
      await sleep(650);
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(salesTx)
      .where(and(eq(salesTx.groupId, groupId), eq(salesTx.type, type)));

    await db
      .update(syncState)
      .set({
        cursor,
        complete,
        oldestCreated: oldest,
        updatedAt: new Date(),
      })
      .where(and(eq(syncState.groupId, groupId), eq(syncState.type, type)));

    return NextResponse.json({
      added,
      pages,
      rateHits,
      complete,
      stored: total,
      oldest: oldest ? oldest.toISOString() : null,
      type,
    });
  } catch (e) {
    return errorOut(e);
  }
}
