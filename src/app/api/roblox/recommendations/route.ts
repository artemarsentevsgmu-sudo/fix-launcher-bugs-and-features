import { NextRequest, NextResponse } from "next/server";
import {
  assetThumbs,
  errorOut,
  getAccountRow,
  publicJson,
  robloxJson,
} from "@/lib/roblox";
import { prng, uid } from "@/lib/utils";
import type { RecCard, RecRail } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RailSpec {
  title: string;
  category: string;
  subcategory?: string;
  sortType: string;
  aggregation: string;
  limit: number;
}

const RAILS: RailSpec[] = [
  { title: "Новинки одежды", category: "3", sortType: "3", aggregation: "5", limit: 28 },
  { title: "Популярно сейчас", category: "3", sortType: "1", aggregation: "1", limit: 28 },
  { title: "Хиты продаж", category: "3", sortType: "2", aggregation: "3", limit: 28 },
  { title: "Свежие аксессуары", category: "11", sortType: "3", aggregation: "5", limit: 28 },
  { title: "Популярные аксессуары", category: "11", sortType: "1", aggregation: "3", limit: 28 },
  { title: "Выбор недели", category: "3", sortType: "1", aggregation: "2", limit: 28 },
  { title: "Обновлённые вещи", category: "11", sortType: "3", aggregation: "5", limit: 28 },
  { title: "Лучшее в каталоге", category: "11", sortType: "2", aggregation: "3", limit: 28 },
  { title: "Дешёвые находки", category: "3", sortType: "4", aggregation: "5", limit: 28 },
  { title: "Премиум-подборка", category: "3", sortType: "5", aggregation: "2", limit: 28 },
];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const nonce = sp.get("nonce") ?? "0";
    const keyword = (sp.get("q") ?? "").trim();
    const c = account.cookie;

    const me = await robloxJson<{ id: number; displayName: string }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    // Режим поиска: одна выдача по ключевому слову вместо персональных рельс
    if (keyword) {
      const rails: RecRail[] = [];
      for (const [label, category] of [
        ["Одежда", "3"],
        ["Аксессуары и UGC", "11"],
      ] as const) {
        const params = new URLSearchParams({
          Category: category,
          Keyword: keyword,
          SortType: "0",
          Limit: "28",
        });
        const res = await publicJson<{
          data: { id: number; name: string; price?: number; assetType?: number }[];
        }>(`https://catalog.roblox.com/v1/search/items/details?${params}`).catch(
          () => ({ data: [] })
        );
        const raw = res.data ?? [];
        if (!raw.length) continue;
        const imgs = await assetThumbs(raw.map((i) => i.id), "150x150");
        rails.push({
          title: `${label} · «${keyword}»`,
          items: raw.map((i) => ({
            id: i.id,
            name: i.name,
            price: typeof i.price === "number" ? i.price : null,
            assetType: String(i.assetType ?? ""),
            image: imgs[String(i.id)] ?? null,
            url: `https://www.roblox.com/catalog/${i.id}`,
          })),
        });
      }
      return NextResponse.json({ rails, forUser: me.displayName, query: keyword });
    }

    // Персональный сид — у каждого аккаунта свои рельсы, как «рекомендации для тебя»
    const rand = prng(uid(`${me.id}:rails:${nonce}`));
    const pool = [...RAILS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, 3);

    const seen = new Set<number>();
    const rails: RecRail[] = [];

    for (const spec of picked) {
      const params = new URLSearchParams({
        Category: spec.category,
        SortType: spec.sortType,
        SortAggregation: spec.aggregation,
        Limit: String(spec.limit),
      });
      if (spec.subcategory) params.set("Subcategory", spec.subcategory);
      // каталог публичный — без куки, с фолбэком на зеркало при рейт-лимите
      const res = await publicJson<{
        data: { id: number; name: string; price?: number; assetType?: number }[];
      }>(`https://catalog.roblox.com/v1/search/items/details?${params}`).catch(
        () => ({ data: [] })
      );

      const raw = (res.data ?? []).filter((i) => {
        if (!i?.id || seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
      if (!raw.length) continue;

      const imgs = await assetThumbs(
        raw.map((i) => i.id),
        "150x150"
      );
      const items: RecCard[] = raw.map((i) => ({
        id: i.id,
        name: i.name,
        price: typeof i.price === "number" ? i.price : null,
        assetType: String(i.assetType ?? ""),
        image: imgs[String(i.id)] ?? null,
        url: `https://www.roblox.com/catalog/${i.id}`,
      }));
      rails.push({ title: spec.title, items });
    }

    return NextResponse.json({ rails, forUser: me.displayName });
  } catch (e) {
    return errorOut(e);
  }
}
