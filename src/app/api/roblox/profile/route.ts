import { NextRequest, NextResponse } from "next/server";
import {
  assetThumbs,
  errorOut,
  getAccountRow,
  groupIcons,
  headshots,
  HttpError,
  parseRoblox,
  publicJson,
  robloxFetch,
  robloxJson,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";

const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

async function gameIcons(universeIds: number[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ids = [...new Set(universeIds)].filter(Boolean);
  if (!ids.length) return out;
  const d = await publicJson<{ data: { targetId: number; imageUrl?: string }[] }>(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids
      .slice(0, 50)
      .join(",")}&size=256x256&format=Png&isCircular=false`
  ).catch(() => null);
  for (const t of d?.data ?? []) if (t.imageUrl) out[String(t.targetId)] = t.imageUrl;
  return out;
}

/* ------------------------------- GET ------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const c = account.cookie;
    const kind = sp.get("kind") ?? "";
    const id = sp.get("id") ?? "";
    if (!id) throw new HttpError(400, "Нет id");

    /* ------------------------------ игрок ----------------------------- */
    if (kind === "user") {
      const [user, friends, followers, following, shots, presence, me, groups] =
        await Promise.all([
          robloxJson<{
            id: number;
            name: string;
            displayName: string;
            description: string;
            created: string;
            isBanned: boolean;
          }>(c, `https://users.roblox.com/v1/users/${id}`),
          safe(robloxJson<{ count: number }>(c, `https://friends.roblox.com/v1/users/${id}/friends/count`)),
          safe(robloxJson<{ count: number }>(c, `https://friends.roblox.com/v1/users/${id}/followers/count`)),
          safe(robloxJson<{ count: number }>(c, `https://friends.roblox.com/v1/users/${id}/followings/count`)),
          headshots([id], "420x420"),
          safe(
            robloxJson<{ userPresences: { userPresenceType: number; lastLocation: string }[] }>(
              c,
              "https://presence.roblox.com/v1/presence/users",
              { method: "POST", body: JSON.stringify({ userIds: [Number(id)] }) }
            )
          ),
          safe(robloxJson<{ id: number }>(c, "https://users.roblox.com/v1/users/authenticated")),
          safe(
            robloxJson<{ data: { group: { id: number; name: string; memberCount: number } }[] }>(
              c,
              `https://groups.roblox.com/v2/users/${id}/groups/roles`
            )
          ),
        ]);

      const status = await safe(
        robloxJson<{ status: string }>(
          c,
          `https://friends.roblox.com/v1/users/${id}/friends/statuses?userIds=${me?.id ?? 0}`
        )
      );

      const p = presence?.userPresences?.[0];
      const groupList = (groups?.data ?? []).slice(0, 8).map((g) => g.group);
      const icons = await groupIcons(groupList.map((g) => g.id));

      return NextResponse.json({
        kind: "user",
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        description: user.description ?? "",
        created: user.created,
        isBanned: user.isBanned,
        avatar: shots[String(id)] ?? null,
        friends: friends?.count ?? 0,
        followers: followers?.count ?? 0,
        following: following?.count ?? 0,
        presence: p?.userPresenceType ?? 0,
        location: p?.lastLocation ?? "",
        isSelf: me?.id === Number(id),
        groups: groupList.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
          icon: icons[String(g.id)] ?? null,
        })),
        friendStatus: (status as { data?: { status: string }[] } | null)?.data?.[0]?.status ?? "NotFriends",
      });
    }

    /* ------------------------------ группа ---------------------------- */
    if (kind === "group") {
      const [group, icons, games, me] = await Promise.all([
        robloxJson<{
          id: number;
          name: string;
          description: string;
          memberCount: number;
          owner: { userId: number; username: string; displayName: string } | null;
          shout: { body: string; poster?: { username: string } } | null;
          publicEntryAllowed: boolean;
          hasVerifiedBadge: boolean;
        }>(c, `https://groups.roblox.com/v1/groups/${id}`),
        groupIcons([id], "420x420"),
        safe(
          robloxJson<{
            data: { id: number; name: string; placeVisits: number; rootPlace?: { id: number } }[];
          }>(c, `https://games.roblox.com/v2/groups/${id}/games?accessFilter=Public&limit=10&sortOrder=Desc`)
        ),
        safe(robloxJson<{ id: number }>(c, "https://users.roblox.com/v1/users/authenticated")),
      ]);

      const myGroups = me
        ? await safe(
            robloxJson<{ data: { group: { id: number } }[] }>(
              c,
              `https://groups.roblox.com/v2/users/${me.id}/groups/roles`
            )
          )
        : null;
      const isMember = (myGroups?.data ?? []).some((g) => g.group.id === Number(id));

      const store = await safe(
        publicJson<{ data: { id: number; name: string; price?: number }[] }>(
          `https://catalog.roblox.com/v1/search/items/details?Category=3&CreatorTargetId=${id}&CreatorType=Group&SortType=3&Limit=10`
        )
      );
      const storeItems = store?.data ?? [];
      const storeImgs = await assetThumbs(storeItems.map((i) => i.id), "150x150");

      const universeIds = (games?.data ?? []).map((g) => g.id);
      const gIcons = await gameIcons(universeIds);

      return NextResponse.json({
        kind: "group",
        id: group.id,
        name: group.name,
        description: group.description ?? "",
        memberCount: group.memberCount,
        icon: icons[String(id)] ?? null,
        hasVerifiedBadge: group.hasVerifiedBadge,
        publicEntryAllowed: group.publicEntryAllowed,
        owner: group.owner,
        shout: group.shout?.body
          ? { body: group.shout.body, poster: group.shout.poster?.username ?? "" }
          : null,
        isMember,
        games: (games?.data ?? []).map((g) => ({
          universeId: g.id,
          placeId: g.rootPlace?.id ?? 0,
          name: g.name,
          visits: g.placeVisits ?? 0,
          thumb: gIcons[String(g.id)] ?? null,
        })),
        store: storeItems.map((i) => ({
          id: i.id,
          name: i.name,
          price: typeof i.price === "number" ? i.price : null,
          image: storeImgs[String(i.id)] ?? null,
        })),
      });
    }

    /* ------------------------------- игра ----------------------------- */
    if (kind === "game") {
      const universeId = Number(id);
      const [info, votes, favCount, icons, thumbs] = await Promise.all([
        publicJson<{
          data: {
            id: number;
            rootPlaceId: number;
            name: string;
            description: string;
            creator: { name: string; type: string; id: number };
            playing: number;
            visits: number;
            maxPlayers: number;
            favoritedCount: number;
            created: string;
            updated: string;
            genre: string;
          }[];
        }>(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
        safe(
          publicJson<{ data: { upVotes: number; downVotes: number }[] }>(
            `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`
          )
        ),
        safe(
          publicJson<{ favoritesCount: number }>(
            `https://games.roblox.com/v1/games/${universeId}/favorites/count`
          )
        ),
        gameIcons([universeId]),
        safe(
          publicJson<{
            data: { thumbnails: { imageUrl?: string }[] }[];
          }>(
            `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=5&size=768x432&format=Png`
          )
        ),
      ]);

      const g = info.data?.[0];
      if (!g) throw new HttpError(404, "Игра не найдена");
      const v = votes?.data?.[0];

      return NextResponse.json({
        kind: "game",
        universeId: g.id,
        placeId: g.rootPlaceId,
        name: g.name,
        description: g.description ?? "",
        creator: g.creator?.name ?? "",
        creatorType: g.creator?.type ?? "",
        creatorId: g.creator?.id ?? 0,
        playing: g.playing ?? 0,
        visits: g.visits ?? 0,
        maxPlayers: g.maxPlayers ?? 0,
        favorites: favCount?.favoritesCount ?? g.favoritedCount ?? 0,
        upVotes: v?.upVotes ?? 0,
        downVotes: v?.downVotes ?? 0,
        created: g.created,
        updated: g.updated,
        icon: icons[String(universeId)] ?? null,
        media: (thumbs?.data?.[0]?.thumbnails ?? [])
          .map((t) => t.imageUrl)
          .filter(Boolean) as string[],
      });
    }

    throw new HttpError(400, "Неизвестный тип");
  } catch (e) {
    return errorOut(e);
  }
}

/* ------------------------------- POST ------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const account = await getAccountRow(String(body?.account ?? ""));
    const c = account.cookie;
    const action = String(body?.action ?? "");
    const targetId = Number(body?.id);
    if (!targetId) throw new HttpError(400, "Нет id");

    const call = async (url: string, method = "POST", payload?: unknown) => {
      const res = await robloxFetch(c, url, {
        method,
        body: payload !== undefined ? JSON.stringify(payload) : JSON.stringify({}),
      });
      if (res.status === 200 || res.status === 204) return;
      await parseRoblox(res);
    };

    if (action === "friend-request") {
      await call(`https://friends.roblox.com/v1/users/${targetId}/request-friendship`);
    } else if (action === "unfriend") {
      await call(`https://friends.roblox.com/v1/users/${targetId}/unfriend`);
    } else if (action === "follow") {
      await call(`https://friends.roblox.com/v1/users/${targetId}/follow`);
    } else if (action === "unfollow") {
      await call(`https://friends.roblox.com/v1/users/${targetId}/unfollow`);
    } else if (action === "join-group") {
      await call(`https://groups.roblox.com/v1/groups/${targetId}/users`);
    } else if (action === "leave-group") {
      const me = await robloxJson<{ id: number }>(
        c,
        "https://users.roblox.com/v1/users/authenticated"
      );
      await call(
        `https://groups.roblox.com/v1/groups/${targetId}/users/${me.id}`,
        "DELETE"
      );
    } else if (action === "favorite-game") {
      await call(
        `https://games.roblox.com/v1/games/${targetId}/favorites`,
        "POST",
        { isFavorited: body?.value !== false }
      );
    } else {
      throw new HttpError(400, "Неизвестное действие");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorOut(e);
  }
}
