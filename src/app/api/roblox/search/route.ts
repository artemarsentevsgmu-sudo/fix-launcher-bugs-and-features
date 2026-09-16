import { NextRequest, NextResponse } from "next/server";
import {
  errorOut,
  getAccountRow,
  groupIcons,
  headshots,
  publicJson,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";

export interface SearchGame {
  universeId: number;
  placeId: number;
  name: string;
  creator: string;
  playing: number | null;
  thumb: string | null;
}
export interface SearchUser {
  id: number;
  name: string;
  displayName: string;
  headshot: string | null;
}
export interface SearchGroup {
  id: number;
  name: string;
  memberCount: number;
  icon: string | null;
  description: string;
}

/**
 * kind=counts — быстрый предпросмотр для выпадашки «что искать».
 * kind=games|users|groups — полный список для отдельного экрана.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    await getAccountRow(sp.get("account"));
    const q = (sp.get("q") ?? "").trim();
    const kind = sp.get("kind") ?? "counts";
    const limit = Math.min(50, Math.max(10, Number(sp.get("limit")) || 30));
    if (q.length < 2) {
      return NextResponse.json({ games: [], users: [], groups: [] });
    }
    const enc = encodeURIComponent(q);

    const loadGames = async (): Promise<SearchGame[]> => {
      const omni = await publicJson<{
        searchResults?: {
          contentGroupType: string;
          contents: {
            universeId: number;
            rootPlaceId?: number;
            name: string;
            creatorName?: string;
            playerCount?: number;
          }[];
        }[];
      }>(
        `https://apis.roblox.com/search-api/omni-search?searchQuery=${enc}&pageToken=&globalSessionId=rl&sessionId=rl`
      ).catch(() => ({ searchResults: [] }));

      const raw = (omni.searchResults ?? [])
        .filter((g) => g.contentGroupType === "Game")
        .flatMap((g) => g.contents ?? [])
        .slice(0, limit);
      const ids = raw.map((g) => g.universeId).filter(Boolean);
      const thumbs = ids.length
        ? await publicJson<{ data: { targetId: number; imageUrl?: string }[] }>(
            `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(
              ","
            )}&size=256x256&format=Png&isCircular=false`
          ).catch(() => ({ data: [] }))
        : { data: [] as { targetId: number; imageUrl?: string }[] };
      const map: Record<string, string> = {};
      for (const t of thumbs.data ?? []) if (t.imageUrl) map[String(t.targetId)] = t.imageUrl;
      return raw.map((g) => ({
        universeId: g.universeId,
        placeId: g.rootPlaceId ?? 0,
        name: g.name,
        creator: g.creatorName ?? "",
        playing: typeof g.playerCount === "number" ? g.playerCount : null,
        thumb: map[String(g.universeId)] ?? null,
      }));
    };

    const loadUsers = async (): Promise<SearchUser[]> => {
      const res = await publicJson<{
        data?: { id: number; name: string; displayName: string }[];
      }>(`https://users.roblox.com/v1/users/search?keyword=${enc}&limit=${Math.min(limit, 25)}`).catch(
        () => ({ data: [] })
      );
      const list = (res.data ?? []).slice(0, limit);
      const shots = await headshots(list.map((u) => u.id), "150x150");
      return list.map((u) => ({
        id: u.id,
        name: u.name,
        displayName: u.displayName,
        headshot: shots[String(u.id)] ?? null,
      }));
    };

    const loadGroups = async (): Promise<SearchGroup[]> => {
      const res = await publicJson<{
        data?: { id: number; name: string; memberCount: number; description?: string }[];
      }>(
        `https://groups.roblox.com/v1/groups/search?keyword=${enc}&limit=${Math.min(
          limit,
          50
        )}&prioritizeExactMatch=true`
      ).catch(() => ({ data: [] }));
      const list = (res.data ?? []).slice(0, limit);
      const icons = await groupIcons(list.map((g) => g.id));
      return list.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount ?? 0,
        description: g.description ?? "",
        icon: icons[String(g.id)] ?? null,
      }));
    };

    if (kind === "games") return NextResponse.json({ games: await loadGames() });
    if (kind === "users") return NextResponse.json({ users: await loadUsers() });
    if (kind === "groups") return NextResponse.json({ groups: await loadGroups() });

    const [games, users, groups] = await Promise.all([
      loadGames(),
      loadUsers(),
      loadGroups(),
    ]);
    return NextResponse.json({
      games: games.slice(0, 6),
      users: users.slice(0, 6),
      groups: groups.slice(0, 6),
      counts: { games: games.length, users: users.length, groups: groups.length },
    });
  } catch (e) {
    return errorOut(e);
  }
}
