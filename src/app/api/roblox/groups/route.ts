import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, groupIcons, robloxJson } from "@/lib/roblox";
import type { GroupEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

interface UserGroupsRes {
  data: {
    group: {
      id: number;
      name: string;
      memberCount: number;
      hasVerifiedBadge: boolean;
    };
    role: { id: number; name: string; rank: number };
  }[];
}

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const c = account.cookie;
    const me = await robloxJson<{ id: number }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    const res = await robloxJson<UserGroupsRes>(
      c,
      `https://groups.roblox.com/v2/users/${me.id}/groups/roles`
    );
    const icons = await groupIcons(res.data.map((g) => g.group.id));

    const groups: GroupEntry[] = (res.data ?? [])
      .map(({ group, role }) => ({
        id: group.id,
        name: group.name,
        memberCount: group.memberCount,
        hasVerifiedBadge: group.hasVerifiedBadge ?? false,
        icon: icons[String(group.id)] ?? null,
        role: { id: role.id, name: role.name, rank: role.rank },
        isOwner: role.rank >= 254,
        canManage: role.rank >= 100,
      }))
      .sort((a, b) => b.role.rank - a.role.rank || b.memberCount - a.memberCount);

    return NextResponse.json({ groups, myUserId: me.id });
  } catch (e) {
    return errorOut(e);
  }
}
