import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, HttpError, robloxFetch, robloxJson, parseRoblox, headshots } from "@/lib/roblox";

export const dynamic = "force-dynamic";

interface RoleLite {
  id: number;
  name: string;
  rank: number;
  memberCount?: number;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    const action = sp.get("action") ?? "";
    if (!groupId) throw new HttpError(400, "groupId?");
    const c = account.cookie;

    if (action === "members") {
      const params = new URLSearchParams({ limit: "25", sortOrder: "Asc" });
      const cursor = sp.get("cursor");
      if (cursor) params.set("cursor", cursor);
      const [members, roles] = await Promise.all([
        robloxJson<any>(c, `https://groups.roblox.com/v1/groups/${groupId}/users?${params}`),
        robloxJson<{ roles: RoleLite[] }>(c, `https://groups.roblox.com/v1/groups/${groupId}/roles`).catch(() => ({ roles: [] })),
      ]);
      const shots = await headshots((members.data ?? []).map((m: any) => m.user?.userId), "100x100");
      return NextResponse.json({
        members: (members.data ?? []).map((m: any) => ({
          userId: m.user?.userId,
          username: m.user?.username,
          displayName: m.user?.displayName,
          headshot: shots[String(m.user?.userId)] ?? null,
          roleId: m.role?.id,
          roleName: m.role?.name,
          rank: m.role?.rank,
        })),
        roles: (roles.roles ?? []).sort((a: RoleLite, b: RoleLite) => a.rank - b.rank),
        nextCursor: members.nextPageCursor ?? null,
        prevCursor: members.previousPageCursor ?? null,
      });
    }

    if (action === "join-requests") {
      const res = await robloxJson<any>(
        c,
        `https://groups.roblox.com/v1/groups/${groupId}/join-requests?limit=25&sortOrder=Asc`
      );
      const shots = await headshots((res.data ?? []).map((r: any) => r.requester?.userId), "100x100");
      return NextResponse.json({
        requests: (res.data ?? []).map((r: any) => ({
          userId: r.requester?.userId,
          username: r.requester?.username,
          displayName: r.requester?.displayName,
          headshot: shots[String(r.requester?.userId)] ?? null,
          created: r.created,
        })),
      });
    }

    if (action === "revenue") {
      const [funds, pending] = await Promise.all([
        robloxJson<{ robux: number }>(c, `https://economy.roblox.com/v1/groups/${groupId}/currency`),
        robloxJson<any>(
          c,
          `https://economy.roblox.com/v2/groups/${groupId}/transactions?limit=100&sortOrder=Desc&transactionType=Sale`
        ).catch(() => null),
      ]);
      const pendingSum = (pending?.data ?? [])
        .filter((t: any) => t.isPending)
        .reduce((s: number, t: any) => s + (t.currency?.amount ?? 0), 0);
      return NextResponse.json({ funds: funds.robux ?? 0, pending: pendingSum });
    }

    if (action === "relations") {
      const [allies, enemies] = await Promise.all([
        robloxJson<any>(c, `https://groups.roblox.com/v1/groups/${groupId}/relationships/allies`).catch(() => ({ data: [] })),
        robloxJson<any>(c, `https://groups.roblox.com/v1/groups/${groupId}/relationships/enemies`).catch(() => ({ data: [] })),
      ]);
      const mapG = (g: any) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        description: g.description ?? "",
      });
      return NextResponse.json({
        allies: (allies.data ?? []).map(mapG),
        enemies: (enemies.data ?? []).map(mapG),
      });
    }

    throw new HttpError(400, "Неизвестный action");
  } catch (e) {
    return errorOut(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const account = await getAccountRow(String(body?.account ?? ""));
    const groupId = String(body?.groupId ?? "");
    const action = String(body?.action ?? "");
    if (!groupId) throw new HttpError(400, "groupId?");
    const c = account.cookie;
    const base = `https://groups.roblox.com/v1/groups/${groupId}`;

    const call = async (path: string, method: string, payload?: unknown) => {
      const res = await robloxFetch(c, `${base}${path}`, {
        method,
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
      if (res.status === 200 || res.status === 204) {
        const data = await parseRoblox<any>(res).catch(() => ({}));
        return data ?? {};
      }
      await parseRoblox(res);
      return {};
    };

    if (action === "set-role") {
      await call(`/users/${body.userId}`, "PATCH", { roleId: Number(body.roleId) });
      return NextResponse.json({ ok: true });
    }
    if (action === "kick") {
      await call(`/users/${body.userId}`, "DELETE");
      return NextResponse.json({ ok: true });
    }
    if (action === "join-handle") {
      await call(`/join-requests/users/${body.userId}`, "PATCH", { accept: !!body.accept });
      return NextResponse.json({ ok: true });
    }
    if (action === "create-role") {
      const name = String(body.name ?? "").trim();
      const rank = Math.max(0, Math.min(254, Math.floor(Number(body.rank) || 0)));
      if (!name) throw new HttpError(400, "Название роли пустое");
      await call(`/roles`, "POST", { name, description: String(body.description ?? ""), rank });
      return NextResponse.json({ ok: true });
    }
    if (action === "update-role") {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.rank !== undefined) patch.rank = Math.max(0, Math.min(254, Math.floor(Number(body.rank) || 0)));
      if (!Object.keys(patch).length) throw new HttpError(400, "Нечего менять");
      await call(`/rolesets/${body.roleId}`, "PATCH", patch);
      return NextResponse.json({ ok: true });
    }
    if (action === "delete-role") {
      await call(`/rolesets/${body.roleId}`, "DELETE");
      return NextResponse.json({ ok: true });
    }
    if (action === "relationship") {
      const target = Number(body.targetId);
      if (!target) throw new HttpError(400, "targetId?");
      const kind = body.verb === "ally" ? "allies" : "enemies";
      const method = body.mode === "remove" ? "DELETE" : "POST";
      await call(`/relationships/${kind}/${target}`, method);
      return NextResponse.json({ ok: true });
    }
    if (action === "settings") {
      const patch: Record<string, unknown> = {};
      if (body.publicEntryAllowed !== undefined) patch.publicEntryAllowed = !!body.publicEntryAllowed;
      if (body.areGroupGamesVisible !== undefined) patch.areGroupGamesVisible = !!body.areGroupGamesVisible;
      if (body.isEnemiesAllowed !== undefined) patch.isEnemiesAllowed = !!body.isEnemiesAllowed;
      if (!Object.keys(patch).length) throw new HttpError(400, "Нечего менять");
      await call(`/settings`, "PATCH", patch);
      return NextResponse.json({ ok: true });
    }

    throw new HttpError(400, "Неизвестный action");
  } catch (e) {
    return errorOut(e);
  }
}
