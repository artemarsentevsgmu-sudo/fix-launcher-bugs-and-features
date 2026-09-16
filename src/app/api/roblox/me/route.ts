import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, headshots, robloxJson } from "@/lib/roblox";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const c = account.cookie;

    const me = await robloxJson<{ id: number; name: string; displayName: string }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );
    const uid = me.id;

    const safe = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const [profile, currency, friends, followers, following, shots] =
      await Promise.all([
        safe(
          robloxJson<{ description: string; created: string }>(
            c,
            `https://users.roblox.com/v1/users/${uid}`
          )
        ),
        safe(
          robloxJson<{ robux: number }>(
            c,
            `https://economy.roblox.com/v1/users/${uid}/currency`
          )
        ),
        safe(
          robloxJson<{ count: number }>(
            c,
            `https://friends.roblox.com/v1/users/${uid}/friends/count`
          )
        ),
        safe(
          robloxJson<{ count: number }>(
            c,
            `https://friends.roblox.com/v1/users/${uid}/followers/count`
          )
        ),
        safe(
          robloxJson<{ count: number }>(
            c,
            `https://friends.roblox.com/v1/users/${uid}/followings/count`
          )
        ),
        headshots([uid], "420x420"),
      ]);

    return NextResponse.json({
      userId: uid,
      name: me.name,
      displayName: me.displayName,
      description: profile?.description ?? "",
      created: profile?.created ?? null,
      robux: currency?.robux ?? null,
      friends: friends?.count ?? 0,
      followers: followers?.count ?? 0,
      following: following?.count ?? 0,
      headshot: shots[String(uid)] ?? null,
    });
  } catch (e) {
    return errorOut(e);
  }
}
