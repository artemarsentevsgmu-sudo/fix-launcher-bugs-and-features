import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, HttpError, robloxFetch, parseRoblox } from "@/lib/roblox";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const account = await getAccountRow(String(body?.account ?? ""));
    const groupId = String(body?.groupId ?? "");
    const field = String(body?.field ?? "");
    const value = String(body?.value ?? "");
    if (!groupId) throw new HttpError(400, "groupId?");
    if (!["name", "description", "status"].includes(field))
      throw new HttpError(400, "Неизвестное поле");

    const c = account.cookie;
    let res: Response;
    if (field === "name") {
      if (value.length < 3 || value.length > 50)
        throw new HttpError(400, "Название: 3–50 символов");
      res = await robloxFetch(
        c,
        `https://groups.roblox.com/v1/groups/${groupId}/name`,
        { method: "PATCH", body: JSON.stringify({ name: value }) }
      );
    } else if (field === "description") {
      res = await robloxFetch(
        c,
        `https://groups.roblox.com/v1/groups/${groupId}/description`,
        { method: "PATCH", body: JSON.stringify({ description: value }) }
      );
    } else {
      res = await robloxFetch(
        c,
        `https://groups.roblox.com/v1/groups/${groupId}/status`,
        { method: "PATCH", body: JSON.stringify({ message: value }) }
      );
    }
    const data = await parseRoblox<any>(res);
    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    return errorOut(e);
  }
}
