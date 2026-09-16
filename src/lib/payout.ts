import { HttpError, robloxFetch, robloxJson, parseRoblox } from "@/lib/roblox";

export interface Recipient {
  username: string;
  amount: number;
}

export interface ChallengeInfo {
  outerChallengeId: string;
  challengeType: string;
  challengeId: string;
  userId: number;
}

export async function resolveUserIds(
  cookie: string,
  usernames: string[]
): Promise<{ username: string; userId: number }[]> {
  const res = await robloxJson<{ data: { id: number; name: string; requestedUsername: string }[] }>(
    cookie,
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",
      body: JSON.stringify({ usernames, excludeBannedUsers: true }),
    }
  );
  const data = res.data ?? [];
  const lower = (s: string) => s.toLowerCase();
  return usernames.map((u) => {
    const hit = data.find(
      (d) => lower(d.name) === lower(u) || lower(d.requestedUsername ?? "") === lower(u)
    );
    if (!hit) throw new HttpError(400, `Пользователь «${u}» не найден`);
    return { username: hit.name, userId: hit.id };
  });
}

export async function sendPayout(
  cookie: string,
  groupId: string,
  recipients: { recipientId: number; amount: number }[],
  challengeHeaders?: Record<string, string>
): Promise<void> {
  const res = await robloxFetch(
    cookie,
    `https://groups.roblox.com/v1/groups/${groupId}/payouts`,
    {
      method: "POST",
      headers: challengeHeaders,
      body: JSON.stringify({
        PayoutType: "FixedAmount",
        Recipients: recipients.map((r) => ({
          recipientId: r.recipientId,
          recipientType: "User",
          amount: r.amount,
        })),
      }),
    }
  );
  if (res.status === 200 || res.status === 204 || res.status === 429) return;
  await parseRoblox(res); // бросит HttpError с ошибкой/challenge
}

function decodeMeta(raw: string | null): any {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

/**
 * Выполняет выплату. Если Roblox требует 2FA — вернёт { challenge },
 * если прошло — { ok: true }.
 */
export async function payoutWithChallenges(
  cookie: string,
  groupId: string,
  recipients: { recipientId: number; amount: number }[]
): Promise<{ ok: true } | { challenge: ChallengeInfo }> {
  try {
    await sendPayout(cookie, groupId, recipients);
    return { ok: true };
  } catch (e) {
    if (!(e instanceof HttpError) || !e.challenge) throw e;
    const ch = e.challenge;

    if (ch.type === "blocksession") {
      throw new HttpError(
        409,
        "Roblox временно пометил сессию. Подожди 1–2 минуты и попробуй снова."
      );
    }

    if (ch.type === "twostepverification") {
      const meta = decodeMeta(ch.metadata);
      return {
        challenge: {
          outerChallengeId: ch.id,
          challengeType: "twostepverification",
          challengeId: meta.challengeId ?? "",
          userId: meta.userId ?? 0,
        },
      };
    }

    if (ch.type === "chef") {
      const decoded = decodeMeta(ch.metadata);
      const cont = await robloxJson<any>(
        cookie,
        "https://apis.roblox.com/challenge/v1/continue",
        {
          method: "POST",
          body: JSON.stringify({
            challengeId: ch.id,
            challengeType: "chef",
            challengeMetadata: typeof decoded === "string" ? decoded : JSON.stringify(decoded),
          }),
        }
      ).catch(() => null);

      const nextType = cont?.challengeType;
      const nextMeta = cont?.challengeMetadata;

      // челлендж решён — повторяем выплату с заголовками chef
      if (!nextType) {
        await sendPayout(cookie, groupId, recipients, {
          "rblx-challenge-id": ch.id,
          "rblx-challenge-type": "chef",
          "rblx-challenge-metadata": ch.metadata ?? "",
        });
        return { ok: true };
      }
      if (nextType === "blocksession") {
        throw new HttpError(
          409,
          "Roblox временно пометил сессию. Подожди 1–2 минуты и попробуй снова."
        );
      }
      if (nextType === "twostepverification") {
        const meta =
          typeof nextMeta === "string"
            ? (() => {
                try {
                  return JSON.parse(nextMeta);
                } catch {
                  return {};
                }
              })()
            : nextMeta ?? {};
        return {
          challenge: {
            outerChallengeId: cont.challengeId ?? ch.id,
            challengeType: "twostepverification",
            challengeId: meta.challengeId ?? "",
            userId: meta.userId ?? 0,
          },
        };
      }
      throw new HttpError(502, `Неизвестный тип проверки: ${nextType}`);
    }

    throw new HttpError(502, `Неизвестный тип проверки безопасности: ${ch.type}`);
  }
}
