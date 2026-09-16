import { NextRequest, NextResponse } from "next/server";
import { errorOut, getAccountRow, HttpError, robloxJson } from "@/lib/roblox";
import { resolveUserIds, sendPayout, type ChallengeInfo } from "@/lib/payout";

export const dynamic = "force-dynamic";

interface VerifyTokenRes {
  verificationToken: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const account = await getAccountRow(String(body?.account ?? ""));
    const groupId = String(body?.groupId ?? "");
    const challenge: ChallengeInfo | undefined = body?.challenge;
    const code = String(body?.code ?? "").replace(/\s/g, "");
    const medium = body?.medium === "email" ? "email" : "authenticator";
    if (!groupId || !challenge?.outerChallengeId || !challenge.challengeId || !challenge.userId) {
      throw new HttpError(400, "Потерян контекст проверки — начни выплату заново");
    }
    if (!code) throw new HttpError(400, "Введи код двухфакторки");

    const list: { username: string; amount: number }[] = Array.isArray(body?.recipients)
      ? body.recipients
      : [];
    const recipients = list
      .map((r) => ({ username: String(r.username).trim(), amount: Math.floor(Number(r.amount)) }))
      .filter((r) => r.username && r.amount > 0);
    if (!recipients.length) throw new HttpError(400, "Список получателей пуст");

    const c = account.cookie;

    // 1. Проверяем TOTP-код, получаем verificationToken
    const verify = await robloxJson<VerifyTokenRes>(
      c,
      `https://twostepverification.roblox.com/v1/users/${challenge.userId}/challenges/${medium}/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          actionType: "Generic",
          challengeId: challenge.challengeId,
          code,
        }),
      }
    ).catch((e: HttpError) => {
      if (e.status === 403 || e.status === 400) {
        throw new HttpError(400, "Неверный код. Проверь приложение и попробуй снова.");
      }
      throw e;
    });

    const token = verify?.verificationToken;
    if (!token) throw new HttpError(502, "Roblox не выдал token подтверждения");

    // 2. Завершаем челлендж
    const metaObj = {
      rememberDevice: false,
      actionType: "Generic",
      verificationToken: token,
      challengeId: challenge.challengeId,
    };
    await robloxJson(
      c,
      "https://apis.roblox.com/challenge/v1/continue",
      {
        method: "POST",
        body: JSON.stringify({
          challengeId: challenge.outerChallengeId,
          challengeType: "twostepverification",
          challengeMetadata: JSON.stringify(metaObj),
        }),
      }
    ).catch(() => null); // 204/200 — ок, остальное уже проверим повторной выплатой

    // 3. Повторяем выплату с заголовками подтверждённого челленджа
    const resolved = await resolveUserIds(c, recipients.map((r) => r.username));
    const merged = recipients.map((r, i) => ({
      recipientId: resolved[i].userId,
      amount: r.amount,
    }));
    const metaB64 = Buffer.from(JSON.stringify(metaObj), "utf8").toString("base64");
    await sendPayout(c, groupId, merged, {
      "rblx-challenge-id": challenge.outerChallengeId,
      "rblx-challenge-type": "twostepverification",
      "rblx-challenge-metadata": metaB64,
    });

    return NextResponse.json({ ok: true, sent: merged.length });
  } catch (e) {
    return errorOut(e);
  }
}
