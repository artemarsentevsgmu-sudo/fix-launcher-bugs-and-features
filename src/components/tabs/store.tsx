"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import type { AccountInfo, RecRail } from "@/lib/types";
import { useRoblox } from "@/components/use-roblox";
import { cn } from "@/lib/utils";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  RobuxValue,
  SectionHead,
  Skeleton,
} from "@/components/ui";

function RailRow({ rail, i }: { rail: RecRail; i: number }) {
  const scroll = (dir: 1 | -1) => {
    const el = document.getElementById(`rail-${i}`);
    el?.scrollBy({ left: dir * 560, behavior: "smooth" });
  };
  return (
    <section>
      <SectionHead
        title={rail.title}
        action={
          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="ghost" size="icon" onClick={() => scroll(-1)} aria-label="Назад">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => scroll(1)} aria-label="Вперёд">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <div
        id={`rail-${i}`}
        className="no-scrollbar -mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1"
      >
        {rail.items.map((item, j) => (
          <motion.a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(j * 0.03, 0.4), duration: 0.25 }}
            whileHover={{ y: -4 }}
            className="group w-36 shrink-0 snap-start"
          >
            <Card className="overflow-hidden transition-shadow duration-200 group-hover:shadow-pop">
              <div className="relative aspect-square bg-card2">
                <Avatar src={item.image} name={item.name} fluid rounded="rounded-none" />
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-card/90 text-muted opacity-0 shadow-card backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
                  <ExternalLink className="size-3.5" />
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-bold leading-tight">{item.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  {item.price !== null ? (
                    <RobuxValue value={item.price} className="text-xs" />
                  ) : (
                    <span className="text-[10px] font-semibold text-muted">не продаётся</span>
                  )}
                </div>
              </div>
            </Card>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

export default function StoreTab({ account }: { account: AccountInfo }) {
  const [nonce, setNonce] = useState(0);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  // ищем с задержкой, чтобы не дёргать каталог на каждую букву
  useEffect(() => {
    const t = setTimeout(() => setQuery(draft.trim()), 550);
    return () => clearTimeout(t);
  }, [draft]);

  const recs = useRoblox<{ rails: RecRail[]; forUser: string }>(
    () =>
      `/api/roblox/recommendations?account=${account.id}&nonce=${nonce}` +
      (query ? `&q=${encodeURIComponent(query)}` : ""),
    [account.id, nonce, query]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Sparkles className="size-5 text-accent-strong" />
            {query
              ? `Поиск: «${query}»`
              : `Рекомендации для ${recs.data?.forUser ?? account.displayName}`}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {query
              ? "Результаты из каталога Roblox по твоему запросу."
              : "Подборки собираются прямо из каталога Roblox и различаются от аккаунта к аккаунту."}
          </p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Искать вещи в каталоге…"
              className="pl-10 pr-9"
            />
            {draft && (
              <button
                onClick={() => setDraft("")}
                aria-label="Очистить"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button variant="outline" onClick={() => setNonce((n) => n + 1)} icon={<RefreshCw />}>
            Обновить
          </Button>
        </div>
      </div>

      {recs.loading ? (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-44" />
              <div className="mt-3 flex gap-3 overflow-hidden">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-48 w-36 shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : recs.error ? (
        <ErrorBox message={recs.error} onRetry={recs.reload} />
      ) : (recs.data?.rails ?? []).length === 0 ? (
        <EmptyState
          icon={<Shirt />}
          title={query ? "Ничего не нашлось" : "Каталог сейчас молчит"}
          hint={
            query
              ? "Попробуй другое слово — поиск идёт по названиям вещей в каталоге Roblox."
              : "Roblox не вернул подборки — попробуй обновить через минуту."
          }
        />
      ) : (
        recs.data!.rails.map((rail, i) => <RailRow key={rail.title + i} rail={rail} i={i} />)
      )}
    </div>
  );
}
