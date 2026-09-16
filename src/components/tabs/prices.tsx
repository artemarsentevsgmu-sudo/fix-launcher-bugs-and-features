"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  CircleAlert,
  ExternalLink,
  Heart,
  Package,
  Search,
  SquareCheck,
  Tags,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import type { AccountInfo, GroupEntry } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtCompact, fmtNum } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Robux,
  RobuxValue,
  Select,
  Skeleton,
} from "@/components/ui";

interface PriceItem {
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

type SortId = "sales" | "favorites" | "priceDesc" | "priceAsc" | "updated";
type Mode = "onsale" | "offsale";

const SORTS: { id: SortId; label: string }[] = [
  { id: "sales", label: "По продажам" },
  { id: "favorites", label: "По фаворитам" },
  { id: "priceDesc", label: "Цена ↓" },
  { id: "priceAsc", label: "Цена ↑" },
  { id: "updated", label: "Сначала новые" },
];

const CATEGORIES = [
  { id: "clothing", label: "Одежда" },
  { id: "ugc", label: "UGC · аксессуары" },
] as const;

export default function PricesTab({ account }: { account: AccountInfo }) {
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
    if (owned.length && !owned.some((g) => String(g.id) === groupId)) {
      setGroupId(String(owned[0].id));
    }
  }, [owned, groupId]);

  const [category, setCategory] = useState<string>("clothing");
  const [sort, setSort] = useState<SortId>("sales");
  const [mode, setMode] = useState<Mode>("onsale");
  const [items, setItems] = useState<PriceItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [scanNote, setScanNote] = useState("");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());

  // реальные продажи за 30 дней — из транзакций группы
  const [salesStats, setSalesStats] = useState<Record<string, { count: number; revenue: number }>>({});
  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    setSalesStats({});
    apiFetch<{ stats: Record<string, { count: number; revenue: number }> }>(
      `/api/roblox/prices/sales?account=${account.id}&groupId=${groupId}`
    )
      .then((d) => alive && setSalesStats(d.stats ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account.id, groupId]);

  const url = useCallback(
    (cur?: string) => {
      const p = new URLSearchParams({
        account: String(account.id),
        groupId,
        category,
        sort,
        mode,
      });
      if (cur) p.set("cursor", cur);
      return `/api/roblox/prices?${p}`;
    },
    [account.id, groupId, category, sort, mode]
  );

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError("");
    setSelected(new Set());
    setReport(null);
    setFailedIds(new Set());
    setScanNote("");
    try {
      const d = await apiFetch<{
        items: PriceItem[];
        nextCursor: string | null;
        scanned?: number;
        more?: boolean;
        note?: string;
      }>(url());
      setItems(d.items ?? []);
      setCursor(d.nextCursor);
      if (d.note) setScanNote(d.note);
      else if (typeof d.scanned === "number")
        setScanNote(
          `Проверено ${d.scanned} последних вещей${d.more ? " (есть ещё, показываем свежие)" : ""}`
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, url]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    setMoreLoading(true);
    try {
      const d = await apiFetch<{ items: PriceItem[]; nextCursor: string | null }>(url(cursor));
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...(d.items ?? []).filter((i) => !seen.has(i.id))];
      });
      setCursor(d.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка догрузки");
    } finally {
      setMoreLoading(false);
    }
  };

  // порядок задаёт Roblox — на клиенте только фильтр по названию
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const soldOf = useCallback(
    (item: PriceItem) => salesStats[String(item.id)]?.count ?? 0,
    [salesStats]
  );

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) shown.forEach((i) => n.delete(i.id));
      else shown.forEach((i) => n.add(i.id));
      return n;
    });

  const apply = async () => {
    const price = Math.floor(Number(bulkPrice));
    if (!Number.isFinite(price)) return;
    setApplying(true);
    setReport(null);
    setError("");
    try {
      const ids = [...selected];
      const chunks: number[][] = [];
      for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));

      let ok = 0;
      let fail = 0;
      const errs: string[] = [];
      const failed = new Set<number>();
      for (const chunk of chunks) {
        const d = await apiFetch<{
          results: { id: number; ok: boolean; error?: string }[];
          okCount: number;
          failCount: number;
        }>("/api/roblox/prices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            account: account.id,
            items: chunk.map((id) => ({ id, price })),
          }),
        });
        ok += d.okCount;
        fail += d.failCount;
        for (const r of d.results) {
          if (!r.ok) {
            failed.add(r.id);
            if (r.error) errs.push(`${r.id}: ${r.error}`);
          }
        }
        const okIds = new Set(d.results.filter((r) => r.ok).map((r) => r.id));
        setItems((prev) =>
          prev.map((i) =>
            okIds.has(i.id)
              ? { ...i, price: price === 0 ? null : price, onSale: price !== 0, priceKnown: true }
              : i
          )
        );
      }
      setReport({ ok, fail, errors: errs.slice(0, 4) });
      setFailedIds(failed);
      if (!fail) {
        setSelected(new Set());
        setBulkPrice("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка применения");
    } finally {
      setApplying(false);
    }
  };

  if (!groups.loading && owned.length === 0) {
    return (
      <EmptyState
        icon={<Tags />}
        title="Нужна своя группа"
        hint="Менять цены можно только там, где у тебя ранг 254+ (владелец)."
      />
    );
  }

  const selCount = selected.size;

  return (
    <div className="space-y-5 pb-28">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Tags className="size-5 text-accent-strong" /> Цены
        </h1>
        <p className="mt-1 text-xs text-muted">
          Сортировку считает сам Roblox по всему каталогу группы, поэтому сверху реальные
          лидеры — даже если вещей несколько тысяч.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="min-w-52 flex-1 sm:flex-none">
          {owned.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-card2 p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors",
                category === c.id ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-card2 p-1">
          {(
            [
              { id: "onsale", label: "В продаже" },
              { id: "offsale", label: "Вне продажи" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors",
                mode === m.id ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "onsale" && (
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="min-w-44">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        )}

        <div className="relative min-w-44 flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Фильтр по названию…"
            className="pl-10"
          />
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}

      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll} icon={allShownSelected ? <X /> : <CheckCheck />}>
            {allShownSelected ? "Снять выделение" : `Выбрать все (${shown.length})`}
          </Button>
          <Badge tone="neutral">
            показано {fmtNum(items.length)}
            {cursor ? "+" : ""}
          </Badge>
          {mode === "onsale" && (
            <Badge tone="accent">
              {SORTS.find((s) => s.id === sort)?.label} · сортирует Roblox
            </Badge>
          )}
          {scanNote && <Badge tone="neutral">{scanNote}</Badge>}
          {selCount > 0 && <Badge tone="accent">выбрано {selCount}</Badge>}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={query ? "Ничего не найдено" : mode === "offsale" ? "Все вещи в продаже" : "Каталог пуст"}
          hint={
            query
              ? "Фильтр ищет по загруженным вещам — подгрузи ещё ниже."
              : mode === "offsale"
                ? "Среди проверенных вещей группы нет снятых с продажи."
                : "Roblox не вернул предметы этой категории."
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {shown.map((item, i) => {
            const checked = selected.has(item.id);
            const sold = soldOf(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min((i % 25) * 0.015, 0.35), duration: 0.18 }}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  checked ? "bg-accent-soft/60" : "hover:bg-card2"
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                    checked ? "border-accent bg-accent text-white" : "border-line-strong"
                  )}
                >
                  {checked && <SquareCheck className="size-3.5" />}
                </span>
                <Avatar src={item.image} name={item.name} size={40} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight">{item.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        item.favorites > 0 ? "text-soft" : "opacity-70"
                      )}
                      title="Фавориты по данным каталога Roblox"
                    >
                      <Heart className="size-3" /> {fmtCompact(item.favorites)}
                    </span>
                    {sold > 0 && (
                      <span
                        className="inline-flex items-center gap-1 font-semibold text-green"
                        title="Продаж за 30 дней (из транзакций группы)"
                      >
                        <TrendingUp className="size-3" /> {fmtCompact(sold)}
                      </span>
                    )}
                    <span className="opacity-70">{item.assetType}</span>
                    {!item.onSale && <Badge tone="amber">не в продаже</Badge>}
                    {failedIds.has(item.id) && <Badge tone="red">не изменилась</Badge>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {item.price !== null ? (
                    <RobuxValue value={item.price} className="text-sm" />
                  ) : (
                    <span className="text-[11px] font-semibold text-muted">
                      {item.priceKnown ? "бесплатно" : "—"}
                    </span>
                  )}
                </div>
                <a
                  href={`https://www.roblox.com/catalog/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="grid size-8 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-card2 hover:text-fg"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </motion.div>
            );
          })}
        </Card>
      )}

      {cursor && !loading && (
        <div className="text-center">
          <Button variant="outline" onClick={more} loading={moreLoading}>
            Загрузить ещё
          </Button>
        </div>
      )}

      <AnimatePresence>
        {report && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className={cn("p-4", report.fail ? "border-amber/25 bg-amber-soft" : "border-green/20 bg-green-soft")}>
              <p className={cn("text-sm font-bold", report.fail ? "text-amber" : "text-green")}>
                Готово: {report.ok} обновлено{report.fail ? `, ${report.fail} с ошибкой` : ""}
              </p>
              {report.errors.map((e, i) => (
                <p key={i} className="mt-1 font-mono text-[10px] text-amber">
                  {e}
                </p>
              ))}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-4 z-40 px-3 sm:px-6"
          >
            <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-3xl border border-line bg-card/90 p-3 shadow-pop backdrop-blur-xl">
              <span className="pl-1.5 text-sm font-bold">Выбрано {selCount}</span>
              <div className="relative min-w-32 flex-1">
                <Robux className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && bulkPrice && apply()}
                  placeholder="Новая цена (0 — снять с продажи)"
                  inputMode="numeric"
                  className="h-10 pl-9"
                />
              </div>
              <Button onClick={apply} loading={applying} disabled={bulkPrice === ""} icon={<Wand2 />}>
                Применить
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelected(new Set())} aria-label="Сбросить">
                <X className="size-4" />
              </Button>
              {bulkPrice !== "" && Number(bulkPrice) !== 0 && Number(bulkPrice) < 5 && (
                <p className="flex w-full items-center gap-1.5 px-1 text-[11px] font-semibold text-red">
                  <CircleAlert className="size-3.5" /> Минимум на Roblox — 5 R$ (или 0, чтобы снять с продажи)
                </p>
              )}
              {applying && (
                <p className="w-full px-1 text-[11px] font-semibold text-muted">
                  Меняем цены… Roblox принимает примерно 5 вещей в секунду, не закрывай вкладку.
                </p>
              )}
              <AnimatePresence>
                {report && !applying && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full overflow-hidden px-1"
                  >
                    <p
                      className={cn(
                        "text-[11px] font-bold",
                        report.fail ? "text-red" : "text-green"
                      )}
                    >
                      {report.fail
                        ? `Обновлено ${report.ok}, не удалось ${report.fail}`
                        : `Готово: цена изменена у ${report.ok} вещей`}
                    </p>
                    {report.errors.map((e, i) => (
                      <p key={i} className="mt-0.5 font-mono text-[10px] text-red/80">
                        {e}
                      </p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] leading-relaxed text-muted/80">
        Поиск каталога Roblox отдаёт максимум ~1000 позиций за запрос, поэтому сортировка
        выполняется на стороне Roblox: «По продажам» и «По фаворитам» возвращают топ по
        всему каталогу, а не по загруженному куску. Счётчик продаж рядом с вещью — из
        реальных транзакций группы за 30 дней.
      </p>
    </div>
  );
}
