import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, HttpError } from "@/lib/roblox";
import { payoutWithChallenges, resolveUserIds } from "@/lib/payout";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const account = await getAccountRow(String(body?.account ?? ""));
    const groupId = String(body?.groupId ?? "");
    if (!groupId) throw new HttpError(400, "Выбери группу");

    const list: { username: string; amount: number }[] = Array.isArray(body?.recipients)
      ? body.recipients
      : [];
    const recipients = list
      .map((r) => ({ username: String(r.username).trim(), amount: Math.floor(Number(r.amount)) }))
      .filter((r) => r.username && r.amount > 0);
    if (!recipients.length) throw new HttpError(400, "Добавь хотя бы одного получателя");
    if (recipients.some((r) => r.amount < 1 || !Number.isFinite(r.amount)))
      throw new HttpError(400, "Сумма должна быть больше 0 R$");

    const c = account.cookie;
    const resolved = await resolveUserIds(c, recipients.map((r) => r.username));
    const merged = recipients.map((r, i) => ({
      recipientId: resolved[i].userId,
      amount: r.amount,
    }));

    const result = await payoutWithChallenges(c, groupId, merged);
    if ("challenge" in result) {
      return NextResponse.json(
        { needVerification: true, challenge: result.challenge },
        { status: 202 }
      );
    }
    return NextResponse.json({ ok: true, sent: merged.length });
  } catch (e) {
    return errorOut(e);
  }
}
