import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, type AccountRow } from "@/db/schema";
import { eq } from "drizzle-orm";

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export class HttpError extends Error {
  status: number;
  code?: number | string;
  challenge?: {
    id: string;
    type: string;
    metadata: string | null;
  };
  constructor(status: number, message: string, code?: number | string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorOut(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    const status = e.status === 403 ? 403 : e.status >= 500 ? 502 : e.status;
    return NextResponse.json(
      { error: e.message, code: e.code ?? null, challenge: e.challenge ?? null },
      { status }
    );
  }
  console.error(e);
  const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function getAccountRow(accountId: string | null): Promise<AccountRow> {
  const id = Number(accountId);
  if (!id) throw new HttpError(400, "Не выбран аккаунт");
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Аккаунт не найден");
  // Запоминаем, какому аккаунту принадлежит куки — нужно для сохранения ротации
  cookieOwner.set(rows[0].cookie, rows[0].id);
  return rows[0];
}

// Грубое кэширование CSRF-токена по куки, чтобы не делать лишний круговой запрос.
const csrfCache = new Map<string, string>();

/** cookie -> id аккаунта в базе (чтобы сохранить обновлённый куки). */
const cookieOwner = new Map<string, number>();
/** старый cookie -> актуальный после ротации Roblox. */
const rotated = new Map<string, string>();

/** Возвращает самый свежий вариант куки (Roblox периодически его ротирует). */
export function freshCookie(cookie: string): string {
  let cur = cookie;
  const seen = new Set<string>();
  while (rotated.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = rotated.get(cur)!;
  }
  return cur;
}

/**
 * Roblox регулярно выдаёт новый .ROBLOSECURITY в заголовке set-cookie и
 * гасит старый. Если это прозевать — сессия «ломается» (что и происходило
 * после выплат). Ловим ротацию и сразу сохраняем новый куки в базу.
 */
async function captureRotation(usedCookie: string, res: Response): Promise<void> {
  let list: string[] = [];
  try {
    list = res.headers.getSetCookie?.() ?? [];
  } catch {
    const single = res.headers.get("set-cookie");
    if (single) list = [single];
  }
  if (!list.length) return;

  for (const raw of list) {
    const m = /\.ROBLOSECURITY=([^;]+)/i.exec(raw);
    const next = m?.[1]?.trim();
    if (!next || next.length < 50) continue;
    if (next === usedCookie || next.startsWith("delete")) continue;

    rotated.set(usedCookie, next);
    const csrf = csrfCache.get(usedCookie);
    if (csrf) csrfCache.set(next, csrf);

    const ownerId = cookieOwner.get(usedCookie);
    if (ownerId) {
      cookieOwner.set(next, ownerId);
      try {
        await db
          .update(accounts)
          .set({ cookie: next })
          .where(eq(accounts.id, ownerId));
        console.log(`[roblox] куки аккаунта #${ownerId} обновлён после ротации`);
      } catch (e) {
        console.error("[roblox] не удалось сохранить обновлённый куки", e);
      }
    }
    return;
  }
}

export async function robloxFetch(
  cookieInput: string,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  for (let attempt = 0; attempt < 2; attempt++) {
    // Всегда берём самый свежий куки — Roblox мог его ротировать
    const cookie = freshCookie(cookieInput);
    const headers = new Headers(init.headers);
    headers.set("cookie", `.ROBLOSECURITY=${cookie}`);
    headers.set("user-agent", UA);
    headers.set("accept", "application/json");
    headers.set("origin", "https://www.roblox.com");
    headers.set("referer", "https://www.roblox.com/");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (method !== "GET") {
      const cached = csrfCache.get(cookie);
      if (cached) headers.set("x-csrf-token", cached);
    }
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers,
        cache: "no-store",
        // Зависший Roblox не должен держать наш запрос вечно
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new HttpError(504, "Roblox не ответил за 15 секунд — попробуй ещё раз");
      }
      throw new HttpError(502, "Не удалось связаться с Roblox");
    }
    // Ловим ротацию сессии до любых проверок статуса
    await captureRotation(cookie, res);

    if (res.status === 403 && method !== "GET") {
      const fresh = res.headers.get("x-csrf-token");
      const sent = headers.get("x-csrf-token");
      if (fresh && fresh !== sent) {
        csrfCache.set(cookie, fresh);
        csrfCache.set(freshCookie(cookieInput), fresh);
        continue;
      }
    }
    return res;
  }
  throw new HttpError(502, "Roblox не отвечает (CSRF)");
}

export async function parseRoblox<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* тело не JSON */
  }
  if (!res.ok) {
    const err0 = Array.isArray(data?.errors) ? data.errors[0] : null;
    const msg =
      err0?.userFacingMessage || err0?.message || data?.Message || `HTTP ${res.status}`;
    const code = err0?.code;
    const e = new HttpError(res.status, msg, code);
    const chId = res.headers.get("rblx-challenge-id");
    const chType = res.headers.get("rblx-challenge-type");
    const chMeta = res.headers.get("rblx-challenge-metadata");
    if (res.status === 403 && chId && chType) {
      e.challenge = { id: chId, type: chType, metadata: chMeta };
    }
    throw e;
  }
  return data as T;
}

export async function robloxJson<T>(
  cookie: string,
  url: string,
  init: RequestInit = {}
): Promise<T> {
  return parseRoblox<T>(await robloxFetch(cookie, url, init));
}

/**
 * Для публичных GET-эндпоинтов (каталог, поиск). Куки не шлём.
 * Если Roblox отвечает рейт-лимитом/CSRF-заглушкой — перепрашиваем
 * через публичное зеркало roproxy.com.
 */
export async function publicJson<T>(url: string): Promise<T> {
  const headers = { "user-agent": UA, accept: "application/json" };
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 429 || res.status >= 500) {
      throw new HttpError(res.status, "rate");
    }
    return (await res.json()) as T;
  } catch (e) {
    const mirror = url.replace(".roblox.com/", ".roproxy.com/");
    if (mirror === url) throw e;
    const res = await fetch(mirror, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      throw new HttpError(
        res.status,
        res.status === 429
          ? "Roblox ограничил запросы — подожди 10–20 секунд и жми «Ещё раз»"
          : `HTTP ${res.status}`
      );
    }
    return (await res.json()) as T;
  }
}

/* ---------------- thumbnails (публичные, куки не нужны) ---------------- */

type ThumbKind = "users/avatar-headshot" | "groups/icons" | "assets" | "games";

async function thumbs(
  kind: ThumbKind,
  idParam: string,
  ids: (number | string)[],
  size: string,
  circular = false
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  if (!unique.length) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const url =
      `https://thumbnails.roblox.com/v1/${kind}?${idParam}=${chunk.join(",")}` +
      `&size=${size}&format=Png&isCircular=${circular}`;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const data: any = await res.json();
      for (const item of data?.data ?? []) {
        if (item?.imageUrl) out[String(item.targetId)] = item.imageUrl;
      }
    } catch (e) {
      console.error("thumbs error", kind, e);
    }
  }
  return out;
}

export const headshots = (ids: (number | string)[], size = "100x100") =>
  thumbs("users/avatar-headshot", "userIds", ids, size, true);
export const groupIcons = (ids: (number | string)[], size = "150x150") =>
  thumbs("groups/icons", "groupIds", ids, size, false);
export const assetThumbs = (ids: (number | string)[], size = "150x150") =>
  thumbs("assets", "assetIds", ids, size, false);
