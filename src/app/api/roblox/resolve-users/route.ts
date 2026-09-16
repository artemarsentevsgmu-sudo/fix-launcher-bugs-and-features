import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, headshots, robloxJson } from "@/lib/roblox";
import type { ResolvedUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const account = await getAccountRow(String(body?.account ?? ""));
    const usernames: string[] = Array.isArray(body?.usernames)
      ? body.usernames.map((u: unknown) => String(u).trim()).filter(Boolean)
      : [];
    if (!usernames.length) return NextResponse.json({ users: [] });

    const c = account.cookie;
    const res = await robloxJson<{
      data: { id: number; name: string; requestedUsername?: string }[];
    }>(
      c,
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        body: JSON.stringify({ usernames: usernames.slice(0, 20), excludeBannedUsers: false }),
      }
    );

    const data = res.data ?? [];
    const shots = await headshots(
      data.map((u) => u.id),
      "100x100"
    );
    const found = new Map(data.map((u) => [u.name.toLowerCase(), u]));

    const users: ResolvedUser[] = usernames.map((u) => {
      const hit = [...found.values()].find(
        (f) =>
          f.name.toLowerCase() === u.toLowerCase() ||
          f.requestedUsername?.toLowerCase() === u.toLowerCase()
      );
      if (!hit) {
        return { username: "", requested: u, userId: 0, headshot: null, ok: false };
      }
      return {
        username: hit.name,
        requested: u,
        userId: hit.id,
        headshot: shots[String(hit.id)] ?? null,
        ok: true,
      };
    });

    return NextResponse.json({ users });
  } catch (e) {
    return errorOut(e);
  }
}
