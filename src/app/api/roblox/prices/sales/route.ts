import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, robloxJson } from "@/lib/roblox";
import { sleep } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RawTx {
  created: string;
  currency?: { amount?: number };
  details?: { id?: number };
}

/**
 * Реальная статистика продаж по предметам группы.
 * Roblox не отдаёт purchaseCount для классической одежды, поэтому считаем
 * сами по истории транзакций экономики — это честные цифры.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    const days = Math.min(90, Math.max(7, Number(sp.get("days")) || 30));
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const c = account.cookie;

    const since = Date.now() - days * 86400000;
    const stats: Record<string, { count: number; revenue: number }> = {};

    let cursor: string | null = null;
    let reachedOld = false;
    // до 40 страниц (4000 продаж): у активных групп бывает 100+ продаж в день,
    // на маленькой выборке топ-предметы терялись
    for (let page = 0; page < 40 && !reachedOld; page++) {
      const params = new URLSearchParams({
        limit: "100",
        sortOrder: "Desc",
        transactionType: "Sale",
      });
      if (cursor) params.set("cursor", cursor);

      const res: { data?: RawTx[]; nextPageCursor?: string | null } =
        await robloxJson<{ data?: RawTx[]; nextPageCursor?: string | null }>(
          c,
          `https://economy.roblox.com/v2/groups/${groupId}/transactions?${params}`
        ).catch((e) => {
          if (page === 0) throw e;
          return { data: [], nextPageCursor: null };
        });

      for (const t of res.data ?? []) {
        const at = new Date(t.created).getTime();
        if (!Number.isNaN(at) && at < since) {
          reachedOld = true;
          break;
        }
        const id = t.details?.id;
        if (!id) continue;
        const key = String(id);
        stats[key] ??= { count: 0, revenue: 0 };
        stats[key].count += 1;
        stats[key].revenue += t.currency?.amount ?? 0;
      }

      cursor = res.nextPageCursor ?? null;
      if (!cursor) break;
      await sleep(200);
    }

    return NextResponse.json({ stats, days });
  } catch (e) {
    return errorOut(e);
  }
}
