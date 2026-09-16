"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  BarChart3,
  Database,
  HandCoins,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AccountInfo, DayPoint, GroupEntry, SalesReport } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtCompact, fmtDate, fmtNum } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  RobuxValue,
  SectionHead,
  Select,
  Skeleton,
} from "@/components/ui";

/* ------------------------------ Chart ------------------------------ */

const W = 640;
const H = 236;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 26;

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function SalesChart({ days }: { days: DayPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(10, ...days.map((d) => d.sales));
  const step = max > 1000 ? 500 : max > 100 ? 50 : 10;
  const niceMax = Math.ceil(max / step) * step;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const pts = days.map((d, i) => ({
    x: PAD_L + (i / Math.max(1, days.length - 1)) * innerW,
    y: PAD_T + innerH - (d.sales / niceMax) * innerH,
    d,
  }));

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1]?.x ?? 0} ${H - PAD_B} L ${pts[0]?.x ?? 0} ${H - PAD_B} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((k) => ({
    y: PAD_T + innerH - k * innerH,
    v: Math.round(niceMax * k),
  }));

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = (e.clientX - rect.left) / rect.width;
    const i = Math.round(rel * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };

  const hov = hover !== null ? pts[hover] : null;

  return (
    <div
      ref={ref}
      className="relative select-none"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={g.y}
              y2={g.y}
              stroke="var(--line)"
              strokeDasharray={i === 0 ? undefined : "3 5"}
              strokeWidth="1"
            />
            <text
              x={W - PAD_R}
              y={g.y - 5}
              textAnchor="end"
              className="fill-muted"
              style={{ fontSize: 9.5, fontWeight: 700 }}
            >
              {fmtCompact(g.v)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#salesFill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hov && (
          <g>
            <line
              x1={hov.x}
              x2={hov.x}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="var(--accent)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
            <circle cx={hov.x} cy={hov.y} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2.5" />
          </g>
        )}
        {days.map((d, i) =>
          i % Math.ceil(days.length / 6) === 0 ? (
            <text
              key={d.date}
              x={pts[i].x}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted"
              style={{ fontSize: 9.5, fontWeight: 600 }}
            >
              {d.date.slice(8)}.{d.date.slice(5, 7)}
            </text>
          ) : null
        )}
      </svg>
      {hov && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-2xl border border-line bg-card px-3 py-2 text-center shadow-pop"
          style={{
            left: `${(hov.x / W) * 100}%`,
            top: `${(hov.y / H) * 100}%`,
            transform: "translate(-50%, -115%)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {hov.d.date.slice(8)}.{hov.d.date.slice(5, 7)}.{hov.d.date.slice(0, 4)}
          </p>
          <RobuxValue value={hov.d.sales} className="text-sm text-accent-strong" />
          {hov.d.commissions > 0 && (
            <p className="text-[10px] font-semibold text-blue">
              комиссии <RobuxValue value={hov.d.commissions} className="text-[10px]" />
            </p>
          )}
          {hov.d.payouts > 0 && (
            <p className="text-[10px] font-semibold text-red">
              выплаты <RobuxValue value={hov.d.payouts} className="text-[10px]" />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Tab -------------------------------- */

function Kpi({
  label,
  value,
  meta,
  icon,
  i,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  icon: React.ReactNode;
  i: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.25 }}
    >
      <Card className="flex items-center gap-3.5 p-4">
        <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent-strong [&>svg]:size-4.5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            {label}
          </p>
          <div className="mt-0.5 text-lg font-extrabold tracking-tight">{value}</div>
          {meta && <p className="text-[10px] font-medium text-muted">{meta}</p>}
        </div>
      </Card>
    </motion.div>
  );
}

export default function AnalyticsTab({ account }: { account: AccountInfo }) {
  const groups = useRoblox<{ groups: GroupEntry[] }>(
    () => `/api/roblox/groups?account=${account.id}`,
    [account.id]
  );
  const owned = useMemo(
    () => (groups.data?.groups ?? []).filter((g) => g.isOwner),
    [groups.data]
  );
  const [groupId, setGroupId] = useState("");
  useEffect(() => {
    if (!owned.length) return;
    // пришли из карточки группы «Показать в аналитике»?
    let want: string | null = null;
    try {
      want = sessionStorage.getItem("hz:analytics-group");
      if (want) sessionStorage.removeItem("hz:analytics-group");
    } catch {}
    if (want && owned.some((g) => String(g.id) === want)) {
      setGroupId(String(want));
      return;
    }
    if (!owned.some((g) => String(g.id) === groupId)) {
      setGroupId(String(owned[0].id));
    }
  }, [owned, groupId]);

  const [range, setRange] = useState(30);
  const sales = useRoblox<
    SalesReport & {
      coverageFrom: string | null;
      stored: number;
      syncComplete: boolean;
      topItems?: { name: string; sold: number; revenue: number }[];
    }
  >(
    () =>
      groupId
        ? `/api/roblox/group/sales?account=${account.id}&groupId=${groupId}&days=${range}`
        : null,
    [account.id, groupId, range]
  );

  // Докачка истории: Roblox отдаёт ~300 транзакций за раз и включает 429,
  // поэтому архив наполняется порциями, а график читает уже накопленное.
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ stored: number; oldest: string | null; done: boolean } | null>(null);
  const syncingRef = useRef(false);

  const runSync = useCallback(
    async (auto: boolean) => {
      if (!groupId || syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        for (let round = 0; round < (auto ? 2 : 6); round++) {
          let done = true;
          for (const type of ["Sale", "Commissions", "GroupPayout"]) {
            const r = await apiFetch<{
              complete: boolean;
              stored: number;
              oldest: string | null;
              added: number;
            }>("/api/roblox/group/sync", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ account: account.id, groupId, type, days: range }),
            });
            if (type === "Sale") {
              setSyncInfo({ stored: r.stored, oldest: r.oldest, done: r.complete });
              if (!r.complete) done = false;
            }
          }
          sales.reload();
          if (done) break;
        }
      } catch {
        /* ошибку покажет сам график */
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account.id, groupId, range]
  );

  // при открытии вкладки один раз подтягиваем свежие данные
  useEffect(() => {
    if (groupId) void runSync(true);
  }, [groupId, runSync]);

  if (!groups.loading && owned.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="Аналитика доступна только для своих групп"
        hint="Нужен аккаунт с рангом 254+ хотя бы в одной группе — тогда покажем реальный график продаж по дням из истории транзакций."
      />
    );
  }

  const r = sales.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <TrendingUp className="size-5 text-accent-strong" />
            Аналитика продаж
          </h1>
          <p className="mt-1 text-xs text-muted">
            Считается из реальной истории транзакций экономики группы — никаких цифр «из
            воздуха».
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-card2 p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={cn(
                  "h-8 rounded-xl px-3.5 text-[13px] font-semibold transition-colors",
                  range === d ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg"
                )}
              >
                {d} дн.
              </button>
            ))}
          </div>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="min-w-48">
            {owned.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            onClick={() => runSync(false)}
            loading={syncing}
            icon={<RefreshCw />}
          >
            {syncing ? "Загружаем…" : "Догрузить историю"}
          </Button>
        </div>
      </div>

      {/* честная полоса покрытия истории */}
      {sales.data && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-semibold",
            sales.data.syncComplete ? "bg-green-soft text-green" : "bg-amber-soft text-amber"
          )}
        >
          <Database className="size-3.5 shrink-0" />
          {sales.data.coverageFrom ? (
            <span>
              В архиве {fmtNum(sales.data.stored)} продаж, история с{" "}
              {fmtDate(sales.data.coverageFrom)}
            </span>
          ) : (
            <span>Архив пуст — идёт первая загрузка</span>
          )}
          {!sales.data.syncComplete && (
            <span className="opacity-80">
              · Roblox отдаёт историю порциями по ~300 записей, поэтому старые дни
              догружаются постепенно. Жми «Догрузить историю», пока не появится нужная дата.
            </span>
          )}
          {syncing && <Loader2 className="size-3.5 animate-spin" />}
          {syncInfo && syncing && <span>+{fmtNum(syncInfo.stored)} в базе</span>}
        </div>
      )}

      {sales.loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : sales.error ? (
        <ErrorBox message={sales.error} onRetry={sales.reload} />
      ) : r ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              i={0}
              label={`Продажи, ${range} дн.`}
              value={<RobuxValue value={r.totalSales30d} />}
              icon={<TrendingUp />}
            />
            <Kpi
              i={1}
              label="Продажи, 7 дней"
              value={<RobuxValue value={r.totalSales7d} />}
              icon={<BadgeDollarSign />}
            />
            <Kpi
              i={2}
              label="Транзакций продаж"
              value={<span className="tabular-nums">{fmtNum(r.txCount30d)}</span>}
              meta={`за ${range} дн.`}
              icon={<Receipt />}
            />
            <Kpi
              i={3}
              label="Выплачено участникам"
              value={<RobuxValue value={r.payouts30d} />}
              meta={`по истории за ${range} дн.`}
              icon={<HandCoins />}
            />
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-5">
              <SectionHead
                title={
                  <>
                    Продажи по дням
                    <Badge tone="accent">{range} дней</Badge>
                    {r.samplingCapped && (
                      <Badge tone="amber">данные за ~1 500 последних продаж</Badge>
                    )}
                  </>
                }
                action={
                  <div className="hidden items-center gap-3 text-[11px] font-semibold text-muted sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-accent" /> продажи
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue" /> комиссии (в тултипе)
                    </span>
                  </div>
                }
              />
              <div className="mt-4">
                {r.days.every((d) => d.sales === 0) ? (
                  <EmptyState
                    icon={<Receipt />}
                    title="В архиве пока нет продаж за этот период"
                    hint="Нажми «Догрузить историю» — лаунчер порциями выкачает транзакции из Roblox и построит график."
                  />
                ) : (
                  <SalesChart days={r.days} />
                )}
              </div>
            </Card>
          </motion.div>

          {r.topBuyers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <Card className="p-5">
                <SectionHead title={`Топ покупателей за ${range} дн.`} />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {r.topBuyers.map((b, i) => (
                    <div
                      key={b.name}
                      className="flex items-center gap-3 rounded-2xl bg-card2 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-xl text-xs font-extrabold",
                          i === 0
                            ? "bg-amber-soft text-amber"
                            : i === 1
                              ? "bg-card2 text-soft"
                              : "bg-card2 text-muted"
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{b.name}</p>
                        <p className="text-[11px] text-muted">{b.count} покупок</p>
                      </div>
                      <RobuxValue value={b.spent} className="text-sm" />
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted/80">
            <Users className="mt-0.5 size-3.5 shrink-0" />
            Источник тот же, что у графика на create.roblox.com → Analytics: продажи и
            комиссии группы из economy API. Roblox не отдаёт готовый график наружу и
            режет историю лимитом ~300 записей за запрос, поэтому лаунчер накапливает
            транзакции в своей базе — с каждой догрузкой график уходит глубже в прошлое.
          </p>
        </>
      ) : null}
    </div>
  );
}
