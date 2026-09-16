"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Clock3,
  Wallet,
  Users,
} from "lucide-react";
import type { AccountInfo, GroupEntry, TxItem, TxPage } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Robux,
  RobuxValue,
  Segmented,
  SectionHead,
  Select,
  Skeleton,
} from "@/components/ui";

/* --------------------------- Types config --------------------------- */

const USER_TYPES = [
  { id: "", label: "Все" },
  { id: "Sale", label: "Продажи" },
  { id: "Purchase", label: "Покупки" },
  { id: "GroupPayout", label: "Выплаты от групп" },
  { id: "Commissions", label: "Комиссии" },
  { id: "PremiumStipend", label: "Премия" },
] as const;

const GROUP_TYPES = [
  { id: "Sale", label: "Продажи" },
  { id: "Commissions", label: "Комиссии" },
  { id: "GroupPayout", label: "Выплаты участникам" },
] as const;

const TYPE_LABEL: Record<string, string> = {
  Sale: "Продажа",
  Purchase: "Покупка",
  GroupPayout: "Выплата",
  Commissions: "Комиссия",
  PremiumStipend: "Премия",
  CurrencyPurchase: "Покупка валюты",
  RobloxFee: "Комиссия Roblox",
  DevSub: "Подписка",
};

const INCOME = new Set(["Sale", "GroupPayout", "Commissions", "PremiumStipend"]);

/**
 * Roblox иногда отдаёт транзакции без agent/currency. Раньше это роняло
 * весь рендер вкладки — теперь любая кривая запись превращается в валидную.
 */
function normalize(raw: unknown, fallbackType: string): TxItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map((r, idx) => {
    const t = r as Partial<TxItem> & { agent?: Partial<TxItem["agent"]> };
    return {
      id: typeof t.id === "number" ? t.id : idx,
      created: typeof t.created === "string" ? t.created : "",
      type: typeof t.type === "string" && t.type ? t.type : fallbackType || "Sale",
      agent: {
        id: Number(t.agent?.id ?? 0) || 0,
        name: String(t.agent?.name ?? "Roblox"),
        type: String(t.agent?.type ?? "User"),
      },
      amount: Number(t.amount ?? 0) || 0,
      isPending: Boolean(t.isPending),
      headshot: typeof t.headshot === "string" ? t.headshot : null,
      item:
        t.item && typeof t.item === "object" && t.item.name
          ? {
              id: typeof t.item.id === "number" ? t.item.id : null,
              name: String(t.item.name),
              type: t.item.type ? String(t.item.type) : null,
              image: typeof t.item.image === "string" ? t.item.image : null,
            }
          : null,
    };
  });
}

function TxRow({
  tx,
  incoming,
  i,
}: {
  tx: TxItem;
  incoming: boolean;
  i: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-card2"
    >
      <div className="relative">
        <Avatar
          src={tx.item?.image ?? tx.headshot}
          name={tx.item?.name ?? tx.agent.name}
          size={40}
          rounded={tx.item?.image ? "rounded-xl" : "rounded-full"}
        />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full border-2 border-card",
            incoming ? "bg-green text-white" : "bg-red-soft text-red"
          )}
        >
          {incoming ? (
            <ArrowDownLeft className="size-2.5" />
          ) : (
            <ArrowUpRight className="size-2.5" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">
          {tx.item?.name ?? tx.agent.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted">
          <span className="shrink-0">{TYPE_LABEL[tx.type] ?? tx.type}</span>
          {tx.item && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate">
                {incoming ? "покупатель" : "продавец"} {tx.agent.name}
              </span>
            </>
          )}
          {tx.isPending && (
            <Badge tone="amber" className="gap-1">
              <Clock3 className="size-2.5" /> ожидает
            </Badge>
          )}
        </p>
      </div>
      <div className="text-right">
        <RobuxValue value={tx.amount} className="text-sm" tone={incoming ? "green" : "red"} />
        <p className="mt-0.5 text-[10px] text-muted">{fmtDateTime(tx.created)}</p>
      </div>
    </motion.div>
  );
}

/* --------------------- Reusable transactions pane --------------------- */

function TxPane({
  endpoint,
  types,
  emptyHint,
}: {
  endpoint: string;
  types: readonly { id: string; label: string }[];
  emptyHint: string;
}) {
  const [type, setType] = useState<string>(types[0].id);
  const [items, setItems] = useState<TxItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [first, setFirst] = useState<TxPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);

  const build = (c?: string) => {
    const p = new URLSearchParams(endpoint.includes("?") ? endpoint.split("?")[1] : "");
    if (type) p.set("type", type);
    if (c) p.set("cursor", c);
    return `${endpoint.split("?")[0]}?${p}`;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiFetch<TxPage>(build());
      setFirst(page);
      setItems(normalize(page.items, type));
      setCursor(page.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setFirst(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, type]);

  useEffect(() => {
    const h = () => void load();
    window.addEventListener("hz:refresh", h);
    return () => window.removeEventListener("hz:refresh", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, type]);

  const more = async () => {
    if (!cursor) return;
    setMoreLoading(true);
    try {
      const page = await apiFetch<TxPage>(build(cursor));
      setItems((prev) => [...prev, ...normalize(page.items, type)]);
      setCursor(page.nextCursor ?? null);
    } catch {
      /* молча — кнопка останется */
    } finally {
      setMoreLoading(false);
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, TxItem[]>();
    for (const t of items) {
      const key = t.created ? fmtDate(t.created) : "Без даты";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
          <span className="grid size-9 place-items-center rounded-xl bg-green-soft text-green">
            <Wallet className="size-4.5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              {endpoint.includes("/group/") ? "Средства группы" : "Баланс"}
            </p>
            {loading && first === null ? (
              <Skeleton className="mt-1 h-4 w-20 rounded-lg" />
            ) : (
              <RobuxValue value={first?.balance ?? null} className="text-base" />
            )}
          </div>
        </div>
        <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-card2 p-1">
          {types.map((t) => (
            <button
              key={t.id || "all"}
              onClick={() => setType(t.id)}
              className={cn(
                "relative h-8 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors",
                type === t.id ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ArrowLeftRight />}
              title="Транзакций пока нет"
              hint={emptyHint}
            />
          </div>
        ) : (
          <div>
            {byDay.map(([day, txs]) => (
              <div key={day}>
                <p className="sticky top-0 z-10 border-y border-line bg-card2/95 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted backdrop-blur">
                  {day}
                </p>
                <div className="p-2">
                  {txs.map((t, i) => (
                    <TxRow key={`${t.id}-${i}`} tx={t} incoming={INCOME.has(t.type)} i={i} />
                  ))}
                </div>
              </div>
            ))}
            {cursor && (
              <div className="border-t border-line p-3 text-center">
                <Button variant="outline" size="sm" loading={moreLoading} onClick={more}>
                  Показать ещё
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------- Tab -------------------------------- */

export default function TransactionsTab({ account }: { account: AccountInfo }) {
  const [pane, setPane] = useState<"mine" | "group">("mine");
  const groups = useRoblox<{ groups: GroupEntry[] }>(
    () => `/api/roblox/groups?account=${account.id}`,
    [account.id]
  );
  const owned = useMemo(
    () => (groups.data?.groups ?? []).filter((g) => g.isOwner),
    [groups.data]
  );
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    if (pane === "group" && owned.length && !groupId) {
      setGroupId(String(owned[0].id));
    }
  }, [pane, owned, groupId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          name="tx-scope"
          value={pane}
          onChange={setPane}
          items={[
            { id: "mine", label: "Мои транзакции" },
            { id: "group", label: "Транзакции группы" },
          ]}
        />
        {pane === "group" &&
          (owned.length > 0 ? (
            <Select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="min-w-56"
            >
              {owned.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          ) : (
            !groups.loading && (
              <p className="text-xs text-muted">Нет групп с рангом 254+ — нужны права владельца</p>
            )
          ))}
      </div>

      {pane === "mine" ? (
        <TxPane
          key={`mine-${account.id}`}
          endpoint={`/api/roblox/transactions?account=${account.id}`}
          types={USER_TYPES}
          emptyHint="Как только что-то купишь или продашь — история с roblox.com/transactions появится здесь."
        />
      ) : groupId ? (
        <TxPane
          key={`group-${account.id}-${groupId}`}
          endpoint={`/api/roblox/group/transactions?account=${account.id}&groupId=${groupId}`}
          types={GROUP_TYPES}
          emptyHint="У этой группы пока не было переводов робуксов. Продажи, комиссии и выплаты участникам отобразятся здесь."
        />
      ) : (
        <EmptyState
          icon={<Users />}
          title="Выбери группу"
          hint="Транзакции доступны для групп, где у тебя ранг 254+."
        />
      )}
    </div>
  );
}
