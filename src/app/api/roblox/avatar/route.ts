import { NextRequest, NextResponse } from "next/server";
import {
  assetThumbs,
  errorOut,
  getAccountRow,
  HttpError,
  parseRoblox,
  robloxFetch,
  robloxJson,
  publicJson,
} from "@/lib/roblox";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Категории инвентаря, которые реально носятся на аватаре. */
export const WEAR_CATEGORIES: { id: string; label: string; types: number[] }[] = [
  { id: "hats", label: "Шляпы", types: [8] },
  { id: "hair", label: "Волосы", types: [41] },
  { id: "face", label: "Лица", types: [18, 42] },
  { id: "shirts", label: "Рубашки", types: [11] },
  { id: "pants", label: "Штаны", types: [12] },
  { id: "tshirts", label: "Футболки", types: [2] },
  { id: "accessories", label: "Аксессуары", types: [43, 44, 45, 46, 47] },
  { id: "layered", label: "Слоёная одежда", types: [64, 65, 66, 67, 68, 69, 70, 71, 72] },
  { id: "gear", label: "Снаряжение", types: [19] },
];

/** Типы, которых на аватаре может быть только один. */
const SINGLE_SLOT = new Set([11, 12, 2, 18, 17, 27, 28, 29, 30, 31]);

interface AvatarAsset {
  id: number;
  name: string;
  assetType: { id: number; name: string };
  meta?: Record<string, unknown>;
}

interface AvatarResponse {
  assets: AvatarAsset[];
  playerAvatarType?: string;
}

async function avatarThumb(userId: number, retries = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    const d = await publicJson<{ data: { imageUrl?: string; state?: string }[] }>(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    ).catch(() => null);
    const url = d?.data?.[0]?.imageUrl;
    if (url) return url;
    // после смены одежды рендер какое-то время в состоянии Pending
    if (i < retries) await new Promise((r) => setTimeout(r, 900));
  }
  return null;
}

const getAvatar = (c: string, userId: number) =>
  robloxJson<AvatarResponse>(c, `https://avatar.roblox.com/v1/users/${userId}/avatar`);

/**
 * Единственный живой способ менять аватар: v2/avatar/set-wearing-assets
 * с телом { assets: [{ id, meta? }] }. Старые v1 .../wear и .../remove
 * Roblox удалил 5 декабря 2025 — они отвечают 404.
 */
async function setWearing(c: string, assets: { id: number; meta?: unknown }[]) {
  const res = await robloxFetch(
    c,
    "https://avatar.roblox.com/v2/avatar/set-wearing-assets",
    {
      method: "POST",
      body: JSON.stringify({
        assets: assets.map((a) => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id })),
      }),
    }
  );
  const data = await parseRoblox<{
    success?: boolean;
    invalidAssetIds?: number[];
    invalidAssets?: { id: number }[];
  }>(res);
  const bad = [
    ...(data?.invalidAssetIds ?? []),
    ...(data?.invalidAssets ?? []).map((a) => a?.id).filter(Boolean),
  ];
  if (bad.length) {
    throw new HttpError(
      400,
      "Roblox отклонил предмет — возможно, он не поддерживается твоим типом аватара (R6/R15)"
    );
  }
  return data;
}

/* ------------------------------- GET ------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const c = account.cookie;
    const category = sp.get("category") ?? "";

    const me = await robloxJson<{ id: number; name: string; displayName: string }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    if (!category) {
      const [avatar, thumb] = await Promise.all([getAvatar(c, me.id), avatarThumb(me.id)]);
      const worn = avatar.assets ?? [];
      const imgs = await assetThumbs(worn.map((a) => a.id), "150x150");
      return NextResponse.json({
        userId: me.id,
        displayName: me.displayName,
        thumb,
        playerAvatarType: avatar.playerAvatarType ?? "R15",
        wearing: worn.map((a) => ({
          id: a.id,
          name: a.name,
          typeId: a.assetType?.id ?? 0,
          typeName: a.assetType?.name ?? "",
          image: imgs[String(a.id)] ?? null,
        })),
      });
    }

    const cat = WEAR_CATEGORIES.find((x) => x.id === category);
    if (!cat) throw new HttpError(400, "Неизвестная категория");

    const items: { id: number; name: string; typeId: number; image: string | null }[] = [];

    for (const typeId of cat.types) {
      const inv = await robloxJson<{
        data: { assetId: number; assetName?: string; name?: string }[];
      }>(
        c,
        `https://inventory.roblox.com/v2/users/${me.id}/inventory/${typeId}?limit=100&sortOrder=Desc`
      ).catch(() => null);
      for (const it of inv?.data ?? []) {
        if (items.some((x) => x.id === it.assetId)) continue;
        items.push({
          id: it.assetId,
          // inventory отдаёт assetName, а не name — из-за этого раньше были «?»
          name: it.assetName ?? it.name ?? `Предмет ${it.assetId}`,
          typeId,
          image: null,
        });
      }
    }

    const imgs = await assetThumbs(items.map((i) => i.id), "150x150");
    for (const it of items) it.image = imgs[String(it.id)] ?? null;

    return NextResponse.json({ items, nextCursor: null });
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
    const assetId = Number(body?.assetId);

    const me = await robloxJson<{ id: number }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    if (action === "wear" || action === "remove") {
      if (!assetId) throw new HttpError(400, "assetId?");
      const current = await getAvatar(c, me.id);
      const worn = current.assets ?? [];

      if (action === "remove") {
        await setWearing(
          c,
          worn.filter((a) => a.id !== assetId).map((a) => ({ id: a.id, meta: a.meta }))
        );
      } else {
        if (worn.some((a) => a.id === assetId)) {
          return NextResponse.json({ ok: true, thumb: await avatarThumb(me.id) });
        }
        // узнаём тип надеваемой вещи, чтобы снять конфликтующий слот
        const det = await robloxJson<{ AssetTypeId?: number }>(
          c,
          `https://economy.roblox.com/v2/assets/${assetId}/details`
        ).catch(() => null);
        const newType = det?.AssetTypeId ?? 0;

        const keep = worn.filter((a) => {
          const t = a.assetType?.id ?? 0;
          if (newType && SINGLE_SLOT.has(newType) && t === newType) return false;
          return true;
        });
        await setWearing(c, [
          ...keep.map((a) => ({ id: a.id, meta: a.meta })),
          { id: assetId },
        ]);
      }
    } else if (action === "set") {
      const ids: number[] = Array.isArray(body?.assetIds)
        ? body.assetIds.map(Number).filter(Boolean)
        : [];
      await setWearing(c, ids.map((id) => ({ id })));
    } else {
      throw new HttpError(400, "Неизвестное действие");
    }

    await robloxFetch(c, "https://avatar.roblox.com/v1/avatar/redraw-thumbnail", {
      method: "POST",
      body: JSON.stringify({}),
    }).catch(() => null);

    return NextResponse.json({ ok: true, thumb: await avatarThumb(me.id) });
  } catch (e) {
    return errorOut(e);
  }
}
