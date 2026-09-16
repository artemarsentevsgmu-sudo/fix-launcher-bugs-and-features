import { NextRequest, NextResponse } from "next/server";
import {
  assetThumbs,
  errorOut,
  getAccountRow,
  HttpError,
  robloxFetch,
  robloxJson,
  parseRoblox,
  publicJson,
} from "@/lib/roblox";
import { sleep } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Поиск каталога Roblox жёстко отдаёт максимум ~1000 позиций на запрос,
 * а в крупной группе вещей бывает 4000+. Поэтому сортируем НА СТОРОНЕ
 * ROBLOX (SortType) — тогда сверху всегда реальные лидеры по фаворитам
 * или продажам, независимо от общего размера каталога.
 */
const SORTS: Record<string, string> = {
  sales: "2", // Bestselling
  favorites: "1", // MostFavorited
  updated: "3",
  priceAsc: "4",
  priceDesc: "5",
};

export const PRICE_CATEGORIES = [
  { id: "clothing", label: "Одежда", category: "3", creationTypes: ["Shirt", "Pants", "TShirt"] },
  { id: "ugc", label: "UGC · аксессуары", category: "11", creationTypes: [] as string[] },
] as const;

const ASSET_TYPE_NAMES: Record<number, string> = {
  2: "Футболка", 8: "Шляпа", 11: "Рубашка", 12: "Штаны", 18: "Лицо", 19: "Снаряжение",
  41: "Волосы", 42: "Лицо (аксессуар)", 43: "Шея", 44: "Плечи", 45: "Спереди",
  46: "Спина", 47: "Пояс", 64: "Футболка (слой)", 65: "Рубашка (слой)", 66: "Штаны (слой)",
  67: "Куртка", 68: "Свитер", 69: "Шорты", 70: "Левая обувь", 71: "Правая обувь", 72: "Платье",
};

interface CatalogRow {
  id: number;
  name: string;
  price?: number | null;
  lowestPrice?: number | null;
  priceStatus?: string;
  favoriteCount?: number;
  assetType?: number;
  itemStatus?: string[];
}

interface OutItem {
  id: number;
  name: string;
  price: number | null;
  onSale: boolean;
  priceKnown: boolean;
  assetType: string;
  image: string | null;
  favorites: number;
  collectible: boolean;
}

/* ------------------------- режим «в продаже» -------------------------- */

async function loadSorted(
  groupId: string,
  category: string,
  sortType: string,
  cursor: string,
  pages = 4
): Promise<{ rows: CatalogRow[]; nextCursor: string | null }> {
  const rows: CatalogRow[] = [];
  let cur: string | null = cursor || null;
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      Category: category,
      CreatorTargetId: groupId,
      CreatorType: "Group",
      SortType: sortType,
      Limit: "30",
    });
    if (cur) params.set("Cursor", cur);
    const res: { data?: CatalogRow[]; nextPageCursor?: string | null } | null =
      await publicJson<{ data?: CatalogRow[]; nextPageCursor?: string | null }>(
        `https://catalog.roproxy.com/v1/search/items/details?${params}`
      ).catch(() => null);
    if (!res) break;
    rows.push(...(res.data ?? []));
    cur = res.nextPageCursor ?? null;
    if (!cur) break;
    await sleep(110);
  }
  return { rows, nextCursor: cur };
}

/* ------------------------ режим «вне продажи» ------------------------- */

interface EconomyDetails {
  Name?: string;
  PriceInRobux?: number | null;
  IsForSale?: boolean;
  AssetTypeId?: number;
  ProductType?: string | null;
}

async function verifyBatch(ids: number[]): Promise<Map<number, EconomyDetails>> {
  const out = new Map<number, EconomyDetails>();
  const CONC = 5;
  for (let i = 0; i < ids.length; i += CONC) {
    await Promise.all(
      ids.slice(i, i + CONC).map(async (id) => {
        const d = await publicJson<EconomyDetails>(
          `https://economy.roproxy.com/v2/assets/${id}/details`
        ).catch(() => null);
        if (d) out.set(id, d);
      })
    );
    await sleep(120);
  }
  return out;
}

async function loadOffSale(
  cookie: string,
  groupId: string,
  types: readonly string[],
  limit = 120
): Promise<{ items: OutItem[]; scanned: number; more: boolean }> {
  const raw: { id: number; name: string }[] = [];
  for (const type of types) {
    let cursor: string | null = null;
    for (let page = 0; page < 20 && raw.length < limit * 3; page++) {
      const params = new URLSearchParams({
        assetType: type,
        groupId,
        limit: "50",
        sortOrder: "Desc",
      });
      if (cursor) params.set("cursor", cursor);
      const res: { data?: { assetId?: number; id?: number; name?: string }[]; nextPageCursor?: string | null } =
        await robloxJson<{
          data?: { assetId?: number; id?: number; name?: string }[];
          nextPageCursor?: string | null;
        }>(
          cookie,
          `https://itemconfiguration.roblox.com/v1/creations/get-assets?${params}`
        ).catch(() => ({ data: [], nextPageCursor: null }));
      for (const it of res.data ?? []) {
        const id = Number(it.assetId ?? it.id);
        if (id) raw.push({ id, name: it.name ?? `Предмет ${id}` });
      }
      cursor = res.nextPageCursor ?? null;
      if (!cursor) break;
    }
  }

  const slice = raw.slice(0, limit);
  const details = await verifyBatch(slice.map((r) => r.id));
  const offsale = slice.filter((r) => details.get(r.id)?.IsForSale === false);
  const imgs = await assetThumbs(offsale.map((r) => r.id), "150x150");

  return {
    items: offsale.map((r) => {
      const d = details.get(r.id);
      return {
        id: r.id,
        name: d?.Name ?? r.name,
        price: typeof d?.PriceInRobux === "number" ? d.PriceInRobux : null,
        onSale: false,
        priceKnown: true,
        assetType: ASSET_TYPE_NAMES[d?.AssetTypeId ?? -1] ?? "Предмет",
        image: imgs[String(r.id)] ?? null,
        favorites: 0,
        collectible: d?.ProductType === "Collectible Item",
      };
    }),
    scanned: slice.length,
    more: raw.length > slice.length,
  };
}

/* ------------------------------- GET ---------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    if (!groupId) throw new HttpError(400, "Выбери группу");
    const categoryId = sp.get("category") ?? "clothing";
    const sortId = sp.get("sort") ?? "sales";
    const cursor = sp.get("cursor") ?? "";
    const mode = sp.get("mode") ?? "onsale";
    const cat = PRICE_CATEGORIES.find((c) => c.id === categoryId) ?? PRICE_CATEGORIES[0];

    if (mode === "offsale") {
      if (!cat.creationTypes.length) {
        return NextResponse.json({
          items: [],
          nextCursor: null,
          note: "Для UGC список вне продажи недоступен",
        });
      }
      const res = await loadOffSale(account.cookie, groupId, cat.creationTypes);
      return NextResponse.json({
        items: res.items,
        nextCursor: null,
        scanned: res.scanned,
        more: res.more,
      });
    }

    const sortType = SORTS[sortId] ?? SORTS.sales;
    const { rows, nextCursor } = await loadSorted(groupId, cat.category, sortType, cursor);

    const seen = new Set<number>();
    const unique = rows.filter((r) => {
      if (!r?.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const imgs = await assetThumbs(unique.map((i) => i.id), "150x150");

    const items: OutItem[] = unique.map((r) => {
      const price =
        typeof r.price === "number"
          ? r.price
          : typeof r.lowestPrice === "number"
            ? r.lowestPrice
            : null;
      return {
        id: r.id,
        name: r.name,
        // предмет из каталога = он продаётся; OffSale только если Roblox прямо сказал
        price,
        onSale: r.priceStatus !== "OffSale",
        priceKnown: price !== null || r.priceStatus === "Free",
        assetType: ASSET_TYPE_NAMES[r.assetType ?? -1] ?? "Предмет",
        image: imgs[String(r.id)] ?? null,
        favorites: r.favoriteCount ?? 0,
        collectible: Boolean(r.itemStatus?.length) && r.lowestPrice != null,
      };
    });

    return NextResponse.json({ items, nextCursor, sort: sortId });
  } catch (e) {
    return errorOut(e);
  }
}

/* --------------------- смена цены одного предмета ---------------------- */

interface ItemDetails {
  collectibleItemId?: string | null;
  price?: number | null;
  saleLocationType?: string | null;
  totalQuantity?: number | null;
}

/**
 * Определяем, коллекционный ли предмет. Каталог часто отвечает 429, поэтому
 * есть повтор и запасной источник (economy), иначе вещь ошибочно считалась
 * классической и смена цены падала с 404.
 */
async function fetchItemDetails(assetId: number): Promise<ItemDetails | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const d = await publicJson<ItemDetails>(
      `https://catalog.roblox.com/v1/catalog/items/${assetId}/details?itemType=Asset`
    ).catch(() => null);
    if (d && (d.collectibleItemId !== undefined || d.price !== undefined)) return d;
    await sleep(500);
  }

  const eco = await publicJson<{
    CollectibleItemId?: string | null;
    PriceInRobux?: number | null;
    ProductType?: string | null;
  }>(`https://economy.roproxy.com/v2/assets/${assetId}/details`).catch(() => null);
  if (!eco) return null;
  return {
    collectibleItemId: eco.CollectibleItemId ?? null,
    price: eco.PriceInRobux ?? null,
  };
}

/**
 * Классическая одежда и новые Collectible Items (UGC-поток) настраиваются
 * РАЗНЫМИ эндпоинтами. Старый /assets/{id}/update-price для коллекционных
 * вещей отвечает 404 — им нужен PATCH /v1/collectibles/{collectibleItemId}.
 */
async function updateOnePrice(
  cookie: string,
  assetId: number,
  price: number
): Promise<void> {
  const details = await fetchItemDetails(assetId);
  const collectibleId = details?.collectibleItemId ?? null;

  if (collectibleId) {
    // saleLocationConfiguration обязателен, но принимает только тип 1 с пустым
    // places — проверено живьём: площадка продажи предмета при этом не меняется
    // (остаётся ShopAndAllExperiences), а любые другие значения дают ошибку 65.
    const res = await robloxFetch(
      cookie,
      `https://itemconfiguration.roblox.com/v1/collectibles/${collectibleId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isFree: false,
          priceInRobux: price > 0 ? price : null,
          priceOffset: 0,
          quantityLimitPerUser: 0,
          resaleRestriction: 2,
          saleLocationConfiguration: { places: [], saleLocationType: 1 },
          saleStatus: price > 0 ? 0 : 1, // 0 = OnSale, 1 = OffSale
        }),
      }
    );
    if (res.status !== 200 && res.status !== 204) await parseRoblox(res);
    return;
  }

  // классическая вещь
  if (price === 0) {
    const res = await robloxFetch(
      cookie,
      `https://itemconfiguration.roblox.com/v1/assets/${assetId}/update-price`,
      {
        method: "POST",
        body: JSON.stringify({
          priceConfiguration: { priceInRobux: null },
          saleStatus: "OffSale",
        }),
      }
    );
    if (res.status !== 200 && res.status !== 204) await parseRoblox(res);
    return;
  }

  const res = await robloxFetch(
    cookie,
    `https://itemconfiguration.roblox.com/v1/assets/${assetId}/update-price`,
    {
      method: "POST",
      body: JSON.stringify({ priceConfiguration: { priceInRobux: price } }),
    }
  );
  if (res.status === 200 || res.status === 204) return;

  // вещь ещё не выпущена в продажу — публикуем
  if (res.status === 400 || res.status === 404) {
    const rel = await robloxFetch(
      cookie,
      `https://itemconfiguration.roblox.com/v1/assets/${assetId}/release`,
      {
        method: "POST",
        body: JSON.stringify({
          priceConfiguration: { priceInRobux: price },
          saleStatus: "OnSale",
          releaseConfiguration: { saleAvailabilityLocations: [0, 1] },
        }),
      }
    );
    if (rel.status === 200 || rel.status === 204) return;
    await parseRoblox(rel);
    return;
  }
  await parseRoblox(res);
}

/* ------------------------- POST: массовая смена ----------------------- */

interface UpdateResult {
  id: number;
  ok: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const account = await getAccountRow(String(body?.account ?? ""));
    const c = account.cookie;

    const list: { id: number; price: number }[] = Array.isArray(body?.items)
      ? body.items
          .map((i: { id: unknown; price: unknown }) => ({
            id: Number(i.id),
            price: Math.floor(Number(i.price)),
          }))
          .filter(
            (i: { id: number; price: number }) =>
              Number.isFinite(i.id) && i.id > 0 && Number.isFinite(i.price)
          )
      : [];

    if (!list.length) throw new HttpError(400, "Не выбрано ни одного предмета");
    if (list.length > 60)
      throw new HttpError(400, "За раз можно менять не больше 60 предметов");
    if (list.some((i) => i.price !== 0 && i.price < 5))
      throw new HttpError(400, "Минимальная цена на Roblox — 5 R$ (или 0, чтобы снять с продажи)");

    const results: UpdateResult[] = [];
    for (const item of list) {
      let lastError = "Ошибка";
      let done = false;
      // Roblox периодически отвечает 429 — ждём и пробуем ещё раз,
      // иначе часть вещей в пачке молча оставалась со старой ценой.
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        try {
          await updateOnePrice(c, item.id, item.price);
          done = true;
        } catch (e) {
          lastError = e instanceof Error ? e.message : "Ошибка";
          const rateLimited =
            (e as { status?: number }).status === 429 || /429/.test(lastError);
          if (!rateLimited) break;
          await sleep(1500 * (attempt + 1));
        }
      }
      results.push(
        done
          ? { id: item.id, ok: true }
          : { id: item.id, ok: false, error: lastError }
      );
      await sleep(420);
    }

    return NextResponse.json({
      results,
      okCount: results.filter((r) => r.ok).length,
      failCount: results.filter((r) => !r.ok).length,
    });
  } catch (e) {
    return errorOut(e);
  }
}
