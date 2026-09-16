import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, headshots, robloxJson } from "@/lib/roblox";
import type { FriendPresence } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PresenceEntry {
  userId: number;
  userPresenceType: 0 | 1 | 2 | 3;
  lastLocation: string;
  placeId: number | null;
  rootPlaceId: number | null;
  gameId: string | null;
  universeId: number | null;
  lastOnline: string;
}

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const c = account.cookie;
    const me = await robloxJson<{ id: number }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    const friendsRes = await robloxJson<{
      data: { id: number; name: string; displayName: string }[];
    }>(c, `https://friends.roblox.com/v1/users/${me.id}/friends`);

    const friends = (friendsRes.data ?? []).slice(0, 400);
    const ids = friends.map((f) => f.id);

    // Roblox недавно начал отдавать пустые name/displayName в v1 friends —
    // догружаем никнеймы отдельным bulk-запросом
    interface Hydrated {
      id: number;
      name: string;
      displayName: string;
      hasVerifiedBadge?: boolean;
    }
    const names = new Map<number, Hydrated>();
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const hydr = await robloxJson<{ data: Hydrated[] }>(
        c,
        "https://users.roblox.com/v1/users",
        { method: "POST", body: JSON.stringify({ userIds: chunk, excludeBannedUsers: false }) }
      ).catch(() => null);
      for (const u of hydr?.data ?? []) names.set(u.id, u);
    }

    // Присутствие — чанками по 50 (лимит presence API)
    const presenceMap: Record<number, PresenceEntry> = {};
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      try {
        const pres = await robloxJson<{ userPresences: PresenceEntry[] }>(
          c,
          "https://presence.roblox.com/v1/presence/users",
          { method: "POST", body: JSON.stringify({ userIds: chunk }) }
        );
        for (const p of pres.userPresences ?? []) presenceMap[p.userId] = p;
      } catch (e) {
        console.error("presence chunk failed", e);
      }
    }

    const shots = await headshots(ids, "150x150");

    const list: FriendPresence[] = friends.map((f) => {
      const p = presenceMap[f.id];
      const h = names.get(f.id);
      return {
        id: f.id,
        name: h?.name || f.name || `#${f.id}`,
        displayName: h?.displayName || f.displayName || `#${f.id}`,
        headshot: shots[String(f.id)] ?? null,
        presence: p?.userPresenceType ?? 0,
        location: p?.userPresenceType === 2 ? p?.lastLocation : null,
        placeId: p?.placeId ?? null,
        rootPlaceId: p?.rootPlaceId ?? null,
        gameId: p?.gameId ?? null,
        universeId: p?.universeId ?? null,
        lastOnline: p?.lastOnline ?? null,
      };
    });

    const order = { 2: 0, 1: 1, 3: 2, 0: 3 } as const;
    list.sort(
      (a, b) =>
        order[a.presence] - order[b.presence] ||
        a.name.localeCompare(b.name, "ru")
    );

    const online = list.filter((f) => f.presence === 1 || f.presence === 3).length;
    const inGame = list.filter((f) => f.presence === 2).length;

    return NextResponse.json({
      friends: list,
      total: friendsRes.data?.length ?? 0,
      online,
      inGame,
    });
  } catch (e) {
    return errorOut(e);
  }
}
