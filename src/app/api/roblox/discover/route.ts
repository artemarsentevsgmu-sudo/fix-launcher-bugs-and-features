import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, publicJson, robloxJson, UA } from "@/lib/roblox";

export const dynamic = "force-dynamic";

export interface GameCard {
  universeId: number;
  placeId: number;
  name: string;
  creator: string;
  playing: number | null;
  thumb: string | null;
}

interface SortGame {
  universeId: number;
  rootPlaceId?: number;
  name: string;
  creatorName?: string;
  playerCount?: number;
  totalUpVotes?: number;
  totalDownVotes?: number;
}

/** Иконки игр — публичный thumbnails API. */
async function gameThumbs(universeIds: number[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(universeIds)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    try {
      const data = await publicJson<{
        data: { targetId: number; imageUrl?: string }[];
      }>(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${chunk.join(
          ","
        )}&size=256x256&format=Png&isCircular=false`
      );
      for (const d of data.data ?? []) {
        if (d.imageUrl) out[String(d.targetId)] = d.imageUrl;
      }
    } catch {
      /* иконки не критичны */
    }
  }
  return out;
}

async function loadSort(sortId: string, limit: number): Promise<GameCard[]> {
  const data = await publicJson<{ games?: SortGame[] }>(
    `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=rl-${Date.now()}&sortId=${sortId}`
  ).catch(() => ({ games: [] }));

  const games = (data.games ?? []).slice(0, limit);
  const thumbs = await gameThumbs(games.map((g) => g.universeId));
  return games.map((g) => ({
    universeId: g.universeId,
    placeId: g.rootPlaceId ?? 0,
    name: g.name,
    creator: g.creatorName ?? "",
    playing: typeof g.playerCount === "number" ? g.playerCount : null,
    thumb: thumbs[String(g.universeId)] ?? null,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const c = account.cookie;

    const me = await robloxJson<{ id: number }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    // Недавно сыгранные: приватный эндпоинт games, требует куки
    const recentRaw = await robloxJson<{
      data: {
        universeId?: number;
        placeId?: number;
        name: string;
        rootPlaceId?: number;
        playerCount?: number;
        creatorName?: string;
      }[];
    }>(
      c,
      `https://games.roblox.com/v2/users/${me.id}/games?accessFilter=Public&limit=10&sortOrder=Desc`
    ).catch(() => null);

    const recentlyVisited = await robloxJson<{
      data: { placeId: number; universeId: number; name: string }[];
    }>(c, "https://games.roblox.com/v1/games/recently-played?limit=10").catch(
      () => null
    );

    const recentSource =
      recentlyVisited?.data?.length
        ? recentlyVisited.data.map((g) => ({
            universeId: g.universeId,
            placeId: g.placeId,
            name: g.name,
            creator: "",
            playing: null as number | null,
          }))
        : (recentRaw?.data ?? []).map((g) => ({
            universeId: g.universeId ?? 0,
            placeId: g.rootPlaceId ?? g.placeId ?? 0,
            name: g.name,
            creator: g.creatorName ?? "",
            playing: g.playerCount ?? null,
          }));

    const recentThumbs = await gameThumbs(recentSource.map((g) => g.universeId));
    const recent: GameCard[] = recentSource.map((g) => ({
      ...g,
      thumb: recentThumbs[String(g.universeId)] ?? null,
    }));

    const [popular, trending] = await Promise.all([
      loadSort("top-playing-now", 12),
      loadSort("top-trending", 12),
    ]);

    return NextResponse.json({ recent, popular, trending });
  } catch (e) {
    return errorOut(e);
  }
}


