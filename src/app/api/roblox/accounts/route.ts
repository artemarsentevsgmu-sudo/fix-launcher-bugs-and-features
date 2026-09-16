import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { errorOut, HttpError, robloxJson } from "@/lib/roblox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: accounts.id,
        userId: accounts.userId,
        username: accounts.username,
        displayName: accounts.displayName,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .orderBy(desc(accounts.id));
    return NextResponse.json({ accounts: rows });
  } catch (e) {
    return errorOut(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    // Нормализуем все варианты вставки: чистый токен, ".ROBLOSECURITY=...",
    // "Cookie: .ROBLOSECURITY=...; other=1", с кавычками и т.п.
    let cookie = String(body?.cookie ?? "").trim();
    if (/\.ROBLOSECURITY/i.test(cookie)) {
      cookie = cookie
        .replace(/^\s*Cookie:\s*/i, "")
        .replace(/^[^=]*\.ROBLOSECURITY\s*=\s*/i, "")
        .replace(/;[\s\S]*$/, "");
    }
    cookie = cookie.replace(/^["']+|["']+$/g, "").trim();
    if (!cookie || cookie.length < 20) {
      throw new HttpError(400, "Вставь куки .ROBLOSECURITY целиком");
    }
    const me = await robloxJson<{ id: number; name: string; displayName: string }>(
      cookie,
      "https://users.roblox.com/v1/users/authenticated"
    ).catch((e: HttpError) => {
      if (e.status === 401) {
        throw new HttpError(401, "Куки недействителен — Roblox отклонил сессию");
      }
      throw e;
    });
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, String(me.id)))
      .limit(1);
    if (existing[0]) {
      await db
        .update(accounts)
        .set({
          cookie,
          username: me.name,
          displayName: me.displayName,
        })
        .where(eq(accounts.id, existing[0].id));
      return NextResponse.json({
        account: {
          id: existing[0].id,
          userId: String(me.id),
          username: me.name,
          displayName: me.displayName,
          createdAt: existing[0].createdAt,
        },
        updated: true,
      });
    }
    const inserted = await db
      .insert(accounts)
      .values({
        userId: String(me.id),
        username: me.name,
        displayName: me.displayName,
        cookie,
      })
      .returning();
    const row = inserted[0];
    return NextResponse.json({
      account: {
        id: row.id,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        createdAt: row.createdAt,
      },
      updated: false,
    });
  } catch (e) {
    return errorOut(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) throw new HttpError(400, "Нет id аккаунта");
    await db.delete(accounts).where(eq(accounts.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorOut(e);
  }
}
