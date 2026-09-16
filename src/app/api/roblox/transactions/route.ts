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

interface TxResponse {
  data: RawTx[];
  nextPageCursor: string | null;
  previousPageCursor: string | null;
}

function mapItems(
  raw: RawTx[],
  type: string,
  shots: Record<string, string>,
  assetImgs: Record<string, string>
): TxItem[] {
  return raw.map((t, i) => ({
    id: t.id ?? i,
    created: t.created,
    type,
    agent: {
      id: t.agent?.id ?? 0,
      name: t.agent?.name ?? "Roblox",
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
}

const assetIdsOf = (raw: RawTx[]) =>
  raw.map((t) => Number(t.details?.id)).filter((n) => Number.isFinite(n) && n > 0);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const account = await getAccountRow(sp.get("account"));
    const c = account.cookie;
    const type = sp.get("type") ?? "";
    const cursor = sp.get("cursor") ?? "";

    const me = await robloxJson<{ id: number }>(
      c,
      "https://users.roblox.com/v1/users/authenticated"
    );

    const balancePromise = robloxJson<{ robux: number }>(
      c,
      `https://economy.roblox.com/v1/users/${me.id}/currency`
    ).catch(() => null);

    const fetchType = (t: string, cur?: string) => {
      const params = new URLSearchParams({ limit: "50", sortOrder: "Desc", transactionType: t });
      if (cur) params.set("cursor", cur);
      return robloxJson<TxResponse>(
        c,
        `https://economy.roblox.com/v2/users/${me.id}/transactions?${params}`
      );
    };

    if (!type) {
      // «Все»: тянем главные типы и склеиваем — у v2 нет поля типа в самих объектах
      const [sales, purchases, payouts, commissions, stipends, balance] = await Promise.all([
        fetchType("Sale").catch(() => null),
        fetchType("Purchase").catch(() => null),
        fetchType("GroupPayout").catch(() => null),
        fetchType("Commissions").catch(() => null),
        fetchType("PremiumStipend").catch(() => null),
        balancePromise,
      ]);
      const groups: [TxResponse | null, string][] = [
        [sales, "Sale"],
        [purchases, "Purchase"],
        [payouts, "GroupPayout"],
        [commissions, "Commissions"],
        [stipends, "PremiumStipend"],
      ];
      const allRaw: { t: RawTx; type: string }[] = [];
      for (const [res, t] of groups) {
        for (const tx of res?.data ?? []) allRaw.push({ t: tx, type: t });
      }
      allRaw.sort((a, b) => +new Date(b.t.created) - +new Date(a.t.created));
      const capped = allRaw.slice(0, 150);
      const ids = capped.filter((x) => x.t.agent?.type === "User").map((x) => x.t.agent.id);
      const [shots, assetImgs] = await Promise.all([
        headshots(ids, "100x100"),
        assetThumbs(assetIdsOf(capped.map((x) => x.t)), "150x150"),
      ]);
      const items: TxItem[] = capped.flatMap((x) =>
        mapItems([x.t], x.type, shots, assetImgs)
      );
      return NextResponse.json({
        balance: balance?.robux ?? null,
        items,
        nextCursor: null, // курсоры появляются при выборе конкретного типа
        prevCursor: null,
      });
    }

    const [tx, balance] = await Promise.all([fetchType(type, cursor || undefined), balancePromise]);
    const raw = tx.data ?? [];
    const ids = raw.filter((t) => t.agent?.type === "User").map((t) => t.agent.id);
    const [shots, assetImgs] = await Promise.all([
      headshots(ids, "100x100"),
      assetThumbs(assetIdsOf(raw), "150x150"),
    ]);

    return NextResponse.json({
      balance: balance?.robux ?? null,
      items: mapItems(raw, type, shots, assetImgs),
      nextCursor: tx.nextPageCursor ?? null,
      prevCursor: tx.previousPageCursor ?? null,
    });
  } catch (e) {
    return errorOut(e);
  }
}
