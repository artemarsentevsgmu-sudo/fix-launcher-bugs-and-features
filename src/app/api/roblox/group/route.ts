import { NextRequest, NextResponse } from "next/server";
import {
  errorOut,
  getAccountRow,
  groupIcons,
  headshots,
  robloxJson,
} from "@/lib/roblox";
import type { GroupDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const groupId = req.nextUrl.searchParams.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const c = account.cookie;

    const g = await robloxJson<any>(c, `https://groups.roblox.com/v1/groups/${groupId}`);

    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const [rolesRes, membersRes, fundsRes, icons] = await Promise.all([
      safe(
        robloxJson<{ roles: { id: number; name: string; rank: number; memberCount?: number }[] }>(
          c,
          `https://groups.roblox.com/v1/groups/${groupId}/roles`
        )
      ),
      safe(
        robloxJson<{
          data: {
            user: { userId: number; username: string; displayName: string };
            role: { name: string; rank: number };
          }[];
        }>(
          c,
          `https://groups.roblox.com/v1/groups/${groupId}/users?limit=100&sortOrder=Asc`
        )
      ),
      safe(
        robloxJson<{ robux: number }>(
          c,
          `https://economy.roblox.com/v1/groups/${groupId}/currency`
        )
      ),
      groupIcons([groupId]),
    ]);

    const memberRows = membersRes?.data ?? [];
    const shots = await headshots(
      memberRows.map((m) => m.user.userId),
      "100x100"
    );

    const detail: GroupDetail = {
      id: g.id,
      name: g.name,
      description: g.description ?? "",
      memberCount: g.memberCount ?? 0,
      icon: icons[String(groupId)] ?? null,
      hasVerifiedBadge: !!g.hasVerifiedBadge,
      publicEntryAllowed: !!g.publicEntryAllowed,
      isLocked: !!g.isLocked,
      owner: g.owner
        ? {
            userId: g.owner.userId,
            username: g.owner.username,
            displayName: g.owner.displayName,
          }
        : null,
      shout: g.shout
        ? {
            body: g.shout.body,
            poster: g.shout.poster?.username ?? "",
            created: g.shout.created,
          }
        : null,
      funds: fundsRes?.robux ?? null,
      roles: (rolesRes?.roles ?? []).sort((a, b) => b.rank - a.rank),
      members: memberRows.map((m) => ({
        userId: m.user.userId,
        username: m.user.username,
        displayName: m.user.displayName,
        headshot: shots[String(m.user.userId)] ?? null,
        roleName: m.role.name,
        rank: m.role.rank,
      })),
      membersTruncated: (g.memberCount ?? 0) > memberRows.length,
    };

    return NextResponse.json(detail);
  } catch (e) {
    return errorOut(e);
  }
}
