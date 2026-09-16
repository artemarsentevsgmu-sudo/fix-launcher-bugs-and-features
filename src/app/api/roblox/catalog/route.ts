import { NextRequest, NextResponse } from "next/server";
import { assetThumbs, errorOut, getAccountRow, publicJson } from "@/lib/roblox";
import type { CatalogItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const ASSET_TYPES: Record<number, string> = {
  2: "Футболка",
  8: "Шляпа",
  11: "Рубашка",
  12: "Штаны",
  17: "Голова",
  18: "Лицо",
  19: "Снаряжение",
  27: "Торс",
  38: "Плагин",
  41: "Волосы",
  42: "Лицо",
  43: "Шея",
  44: "Плечи",
  45: "Спереди",
  46: "Спина",
  47: "Пояс",
  58: "Свитер",
  59: "Шорты",
  60: "Юбка",
  61: "Эмоция",
  72: "Футболка (слой)",
  73: "Рубашка (слой)",
  74: "Штаны (слой)",
  75: "Свитер (слой)",
  76: "Куртка",
  77: "Кроссовки",
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const category = sp.get("category") ?? "3"; // 3 — одежда, 11 — аксессуары/UGC
    const cursor = sp.get("cursor") ?? "";
    void account; // аккаунт просто проверяет контекст, каталог публичный

    const params = new URLSearchParams({
      Category: category,
      CreatorTargetId: groupId,
      CreatorType: "Group",
      SortType: "3", // недавно обновлённые
      SortAggregation: "5",
      Limit: "30",
    });
    if (cursor) params.set("Cursor", cursor);

    const res = await publicJson<{
      data: {
        id: number;
        name: string;
        assetType?: number;
        price?: number;
        favoriteCount?: number;
        itemStatus?: string[];
      }[];
      nextPageCursor: string | null;
    }>(`https://catalog.roblox.com/v1/search/items/details?${params}`);

    const raw = res.data ?? [];
    const imgs = await assetThumbs(
      raw.map((i) => i.id),
      "150x150"
    );

    const items: CatalogItem[] = raw.map((i) => {
      const limited =
        i.itemStatus?.includes("Limited") ||
        i.itemStatus?.includes("LimitedUnique") ||
        false;
      return {
        id: i.id,
        name: i.name,
        price: typeof i.price === "number" ? i.price : null,
        favoriteCount: i.favoriteCount ?? 0,
        assetType: ASSET_TYPES[i.assetType ?? -1] ?? "Предмет",
        isLimited: limited,
        image: imgs[String(i.id)] ?? null,
      };
    });

    return NextResponse.json({ items, nextCursor: res.nextPageCursor ?? null });
  } catch (e) {
    return errorOut(e);
  }
}
