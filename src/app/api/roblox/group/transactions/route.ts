import { NextRequest, NextResponse } from "next/server";
import { assetThumbs, errorOut, getAccountRow, headshots, robloxJson } from "@/lib/roblox";
import type { TxItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RawTx {
  created: string;
  id: number;
  isPending: boolean;
  agent: { id: number; name: string; type: string };
  currency: { amount: number; type: string };
  details?: { id?: number; name?: string; type?: string };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const c = account.cookie;
    const type = sp.get("type") ?? "";
    const cursor = sp.get("cursor") ?? "";

    const params = new URLSearchParams({ limit: "50", sortOrder: "Desc" });
    if (type) params.set("transactionType", type);
    if (cursor) params.set("cursor", cursor);

    const [tx, funds] = await Promise.all([
      robloxJson<{
        data: RawTx[];
        nextPageCursor: string | null;
        previousPageCursor: string | null;
      }>(c, `https://economy.roblox.com/v2/groups/${groupId}/transactions?${params}`),
      robloxJson<{ robux: number }>(
        c,
        `https://economy.roblox.com/v1/groups/${groupId}/currency`
      ).catch(() => null),
    ]);

    const raw = tx.data ?? [];
    const ids = raw.filter((t) => t.agent?.type === "User").map((t) => t.agent.id);
    const assetIds = raw
      .map((t) => Number(t.details?.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    const [shots, assetImgs] = await Promise.all([
      headshots(ids, "100x100"),
      assetThumbs(assetIds, "150x150"),
    ]);

    const items: TxItem[] = raw.map((t, i) => ({
      id: t.id ?? i,
      created: t.created,
      type,
      agent: {
        id: t.agent?.id ?? 0,
        name: t.agent?.name ?? "Пользователь",
        type: t.agent?.type ?? "User",
      },
      amount: t.currency?.amount ?? 0,
      isPending: !!t.isPending,
      headshot: shots[String(t.agent?.id)] ?? null,
      item: t.details?.name
        ? {
            id: t.details.id ?? null,
            name: t.details.name,
            type: t.details.type ?? null,
            image: assetImgs[String(t.details.id)] ?? null,
          }
        : null,
    }));

    return NextResponse.json({
      balance: funds?.robux ?? null,
      items,
      nextCursor: tx.nextPageCursor ?? null,
      prevCursor: tx.previousPageCursor ?? null,
    });
  } catch (e) {
    return errorOut(e);
  }
}
