import { NextRequest, NextResponse } from "next/server";
import {
  errorOut,
  getAccountRow,
  HttpError,
  parseRoblox,
  robloxFetch,
  robloxJson,
  headshots,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";

const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/** Часть аккаунт-эндпоинтов Roblox блокирует по региону IP (401). */
const probe = async <T,>(p: Promise<T>): Promise<{ data: T | null; blocked: boolean }> => {
  try {
    return { data: await p, blocked: false };
  } catch (e) {
    const status = (e as { status?: number }).status;
    return { data: null, blocked: status === 401 || status === 403 };
  }
};

/* ------------------------------- GET ------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const account = await getAccountRow(req.nextUrl.searchParams.get("account"));
    const c = account.cookie;

    const me = await robloxJson<{ id: number; name: string; displayName: string }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    const [
      profile,
      email,
      phone,
      birthdate,
      twoStep,
      premium,
      robux,
      sessions,
      privacy,
      shots,
      nameHistory,
    ] = await Promise.all([
      safe(
        robloxJson<{ description: string; created: string; isBanned: boolean }>(
          c,
          `https://users.roblox.com/v1/users/${me.id}`
        )
      ),
      probe(
        robloxJson<{ emailAddress: string; verified: boolean }>(
          c,
          "https://accountsettings.roblox.com/v1/email"
        )
      ),
      safe(
        robloxJson<{ countryCode: string; prefix: string; phone: string; isVerified: boolean }>(
          c,
          "https://accountinformation.roblox.com/v1/phone"
        )
      ),
      safe(
        robloxJson<{ birthMonth: number; birthDay: number; birthYear: number }>(
          c,
          "https://accountinformation.roblox.com/v1/birthdate"
        )
      ),
      safe(
        robloxJson<{
          twoStepVerificationEnabled?: boolean;
          activeMediaType?: string;
        }>(c, `https://twostepverification.roblox.com/v1/metadata?userId=${me.id}`)
      ),
      safe(
        robloxJson<{ isPremium: boolean }>(
          c,
          `https://premiumfeatures.roblox.com/v1/users/${me.id}/validate-membership`
        ).then((r) => ({ isPremium: Boolean(r) }))
      ),
      safe(
        robloxJson<{ robux: number }>(
          c,
          `https://economy.roblox.com/v1/users/${me.id}/currency`
        )
      ),
      probe(
        robloxJson<{
          sessions?: {
            token: string;
            lastAccessedIp?: string;
            location?: { city?: string; region?: string; country?: string };
            deviceType?: string;
            lastAccessedTimestampEpochMilliseconds?: number;
            isCurrentSession?: boolean;
          }[];
        }>(c, "https://apis.roblox.com/token-metadata-service/v1/sessions?desiredLimit=25")
      ),
      safe(
        robloxJson<{ appChatPrivacy: string; gameChatPrivacy: string }>(
          c,
          "https://accountsettings.roblox.com/v1/privacy/chat"
        )
      ),
      headshots([me.id], "150x150"),
      safe(
        robloxJson<{ data: { name: string }[] }>(
          c,
          `https://users.roblox.com/v1/users/${me.id}/username-history?limit=25&sortOrder=Desc`
        )
      ),
    ]);

    return NextResponse.json({
      userId: me.id,
      username: me.name,
      displayName: me.displayName,
      headshot: shots[String(me.id)] ?? null,
      description: profile?.description ?? "",
      created: profile?.created ?? null,
      robux: robux?.robux ?? null,
      email: email.data
        ? { masked: email.data.emailAddress ?? "", verified: !!email.data.verified }
        : null,
      emailBlocked: email.blocked,
      sessionsBlocked: sessions.blocked,
      phone: phone?.phone
        ? { masked: `${phone.prefix ?? ""} ${phone.phone}`, verified: !!phone.isVerified }
        : null,
      birthdate: birthdate ?? null,
      twoStep: twoStep
        ? {
            enabled: !!twoStep.twoStepVerificationEnabled,
            mediaType: twoStep.activeMediaType ?? "",
          }
        : null,
      premium: premium?.isPremium ?? false,
      chatPrivacy: privacy?.appChatPrivacy ?? null,
      pastUsernames: (nameHistory?.data ?? []).map((n) => n.name),
      sessions: (sessions.data?.sessions ?? []).map((s) => ({
        token: s.token,
        ip: s.lastAccessedIp ?? "",
        location: [s.location?.city, s.location?.region, s.location?.country]
          .filter(Boolean)
          .join(", "),
        device: s.deviceType ?? "",
        lastSeen: s.lastAccessedTimestampEpochMilliseconds
          ? new Date(s.lastAccessedTimestampEpochMilliseconds).toISOString()
          : null,
        current: !!s.isCurrentSession,
      })),
    });
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

    const call = async (url: string, method: string, payload?: unknown) => {
      const res = await robloxFetch(c, url, {
        method,
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
      if (res.status === 200 || res.status === 204) {
        return await parseRoblox<unknown>(res).catch(() => ({}));
      }
      await parseRoblox(res);
      return {};
    };

    if (action === "display-name") {
      const me = await robloxJson<{ id: number }>(
        c,
        "https://users.roblox.com/v1/users/authenticated"
      );
      const name = String(body?.value ?? "").trim();
      if (name.length < 3) throw new HttpError(400, "Минимум 3 символа");
      await call(`https://users.roblox.com/v1/users/${me.id}/display-names`, "PATCH", {
        newDisplayName: name,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "description") {
      await call("https://accountinformation.roblox.com/v1/description", "POST", {
        description: String(body?.value ?? ""),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "username") {
      const username = String(body?.username ?? "").trim();
      const password = String(body?.password ?? "");
      if (!username || !password)
        throw new HttpError(400, "Нужны новый ник и текущий пароль");
      await call("https://auth.roblox.com/v1/username", "POST", {
        username,
        password,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "password") {
      const currentPassword = String(body?.currentPassword ?? "");
      const newPassword = String(body?.newPassword ?? "");
      if (newPassword.length < 8)
        throw new HttpError(400, "Новый пароль — минимум 8 символов");
      await call("https://auth.roblox.com/v2/user/passwords/change", "POST", {
        currentPassword,
        newPassword,
      });
      return NextResponse.json({ ok: true, note: "cookie-may-rotate" });
    }

    if (action === "email") {
      const emailAddress = String(body?.email ?? "").trim();
      const password = String(body?.password ?? "");
      if (!emailAddress) throw new HttpError(400, "Укажи почту");
      await call("https://accountsettings.roblox.com/v1/email", "POST", {
        emailAddress,
        password,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "verify-email-resend") {
      await call("https://accountsettings.roblox.com/v1/email/verify", "POST", {});
      return NextResponse.json({ ok: true });
    }

    if (action === "revoke-session") {
      const token = String(body?.token ?? "");
      if (!token) throw new HttpError(400, "Нет токена сессии");
      await call(
        "https://apis.roblox.com/token-metadata-service/v1/sessions/logout",
        "POST",
        { token }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "logout-others") {
      await call("https://auth.roblox.com/v2/logout-all-others", "POST", {});
      return NextResponse.json({ ok: true, note: "cookie-may-rotate" });
    }

    throw new HttpError(400, "Неизвестное действие");
  } catch (e) {
    return errorOut(e);
  }
}
