import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, robloxJson } from "@/lib/roblox";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const groupId = req.nextUrl.searchParams.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const funds = await robloxJson<{ robux: number }>(
      account.cookie,
      `https://economy.roblox.com/v1/groups/${groupId}/currency`
    );
    return NextResponse.json({ funds: funds.robux ?? 0 });
  } catch (e) {
    return errorOut(e);
  }
}
