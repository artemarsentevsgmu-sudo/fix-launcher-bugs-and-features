import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesTx, syncState } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { errorOut, getAccountRow } from "@/lib/roblox";
import type { DayPoint, SalesReport } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * График строится из локального архива транзакций (его наполняет
 * /api/roblox/group/sync). Так история не зависит от жёсткого рейт-лимита
 * Roblox, который отдаёт всего ~300 записей за раз.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    await getAccountRow(sp.get("account"));
    const groupId = sp.get("groupId");
    if (!groupId) return NextResponse.json({ error: "groupId?" }, { status: 400 });
    const days = Math.min(120, Math.max(7, Number(sp.get("days")) || 30));

    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .select({
        type: salesTx.type,
        created: salesTx.created,
        amount: salesTx.amount,
        agentName: salesTx.agentName,
        itemName: salesTx.itemName,
      })
      .from(salesTx)
      .where(and(eq(salesTx.groupId, groupId), gte(salesTx.created, since)));

    const map = new Map<string, DayPoint>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, sales: 0, commissions: 0, payouts: 0, salesCount: 0 });
    }

    const buyers = new Map<string, { spent: number; count: number }>();
    const items = new Map<string, { sold: number; revenue: number }>();
    let txCount = 0;

    for (const r of rows) {
      const key = r.created.toISOString().slice(0, 10);
      const point = map.get(key);
      if (!point) continue;
      if (r.type === "Sale") {
        point.sales += r.amount;
        point.salesCount += 1;
        txCount += 1;
        const b = buyers.get(r.agentName ?? "—") ?? { spent: 0, count: 0 };
        b.spent += r.amount;
        b.count += 1;
        buyers.set(r.agentName ?? "—", b);
        if (r.itemName) {
          const it = items.get(r.itemName) ?? { sold: 0, revenue: 0 };
          it.sold += 1;
          it.revenue += r.amount;
          items.set(r.itemName, it);
        }
      } else if (r.type === "Commissions") {
        point.commissions += r.amount;
      } else if (r.type === "GroupPayout") {
        point.payouts += r.amount;
      }
    }

    const list = [...map.values()];
    const last7 = list.slice(-7).reduce((s, d) => s + d.sales, 0);

    // насколько глубоко реально накоплена история
    const [cov] = await db
      .select({
        oldest: sql<string | null>`min(${salesTx.created})`,
        stored: sql<number>`count(*)::int`,
      })
      .from(salesTx)
      .where(and(eq(salesTx.groupId, groupId), eq(salesTx.type, "Sale")));

    const states = await db
      .select()
      .from(syncState)
      .where(and(eq(syncState.groupId, groupId), eq(syncState.type, "Sale")));

    const report: SalesReport & {
      coverageFrom: string | null;
      stored: number;
      syncComplete: boolean;
      topItems: { name: string; sold: number; revenue: number }[];
      days_: number;
    } = {
      days: list,
      totalSales30d: list.reduce((s, d) => s + d.sales, 0),
      totalSales7d: last7,
      txCount30d: txCount,
      payouts30d: list.reduce((s, d) => s + d.payouts, 0),
      pointsSampled: rows.length,
      samplingCapped: false,
      topBuyers: [...buyers.entries()]
        .map(([name, v]) => ({ name, spent: v.spent, count: v.count }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 6),
      topItems: [...items.entries()]
        .map(([name, v]) => ({ name, sold: v.sold, revenue: v.revenue }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 6),
      coverageFrom: cov?.oldest ? new Date(cov.oldest).toISOString() : null,
      stored: cov?.stored ?? 0,
      syncComplete: states[0]?.complete ?? false,
      days_: days,
    };

    return NextResponse.json(report);
  } catch (e) {
    return errorOut(e);
  }
}
