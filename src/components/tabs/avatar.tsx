"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Eraser,
  Loader2,
  PersonStanding,
  RefreshCw,
  Search,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import type { AccountInfo } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  SectionHead,
  Skeleton,
} from "@/components/ui";

interface WornItem {
  id: number;
  name: string;
  typeId: number;
  typeName: string;
  image: string | null;
}

interface AvatarState {
  userId: number;
  displayName: string;
  thumb: string | null;
  playerAvatarType: string;
  wearing: WornItem[];
}

interface InvItem {
  id: number;
  name: string;
  typeId: number;
  image: string | null;
}

const CATEGORIES = [
  { id: "hats", label: "Шляпы" },
  { id: "hair", label: "Волосы" },
  { id: "face", label: "Лица" },
  { id: "shirts", label: "Рубашки" },
  { id: "pants", label: "Штаны" },
  { id: "tshirts", label: "Футболки" },
  { id: "accessories", label: "Аксессуары" },
  { id: "layered", label: "Слоёная" },
  { id: "gear", label: "Снаряжение" },
] as const;

export default function AvatarTab({ account }: { account: AccountInfo }) {
  const avatar = useRoblox<AvatarState>(
    () => `/api/roblox/avatar?account=${account.id}`,
    [account.id]
  );
  const [category, setCategory] = useState<string>("hats");
  const inv = useRoblox<{ items: InvItem[] }>(
    () => `/api/roblox/avatar?account=${account.id}&category=${category}`,
    [account.id, category]
  );

  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (avatar.data?.thumb) setThumb(avatar.data.thumb);
  }, [avatar.data?.thumb]);

  const wornIds = useMemo(
    () => new Set((avatar.data?.wearing ?? []).map((w) => w.id)),
    [avatar.data]
  );

  const act = async (action: "wear" | "remove" | "set", assetId?: number, assetIds?: number[]) => {
    setBusyId(assetId ?? -1);
    setError("");
    try {
      const res = await apiFetch<{ ok: boolean; thumb: string | null }>(
        "/api/roblox/avatar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account: account.id, action, assetId, assetIds }),
        }
      );
      // пустой thumb = рендер ещё готовится, оставляем прежнюю картинку
      if (res.thumb) setThumb(res.thumb);
      avatar.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const shownInv = useMemo(() => {
    const list = inv.data?.items ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((i) => i.name.toLowerCase().includes(q)) : list;
  }, [inv.data, query]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <PersonStanding className="size-5 text-accent-strong" /> Аватар
        </h1>
        <p className="mt-1 text-xs text-muted">
          Твой образ как в Roblox: надевай и снимай вещи из инвентаря — изменения уходят
          на аккаунт сразу.
        </p>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* ------------------------- превью образа ------------------------- */}
        <div className="space-y-3">
          <Card className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent-soft blur-2xl" />
            <div className="relative">
              <div className="mx-auto grid aspect-[3/4] w-full max-w-64 place-items-center overflow-hidden rounded-3xl bg-card2">
                {avatar.loading && !thumb ? (
                  <Skeleton className="h-full w-full rounded-3xl" />
                ) : thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt="Аватар"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <PersonStanding className="size-16 text-muted" />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {avatar.data?.displayName ?? account.displayName}
                  </p>
                  <p className="text-[11px] text-muted">
                    {avatar.data?.playerAvatarType ?? "R15"} ·{" "}
                    {avatar.data?.wearing.length ?? 0} предметов
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    avatar.reload();
                    inv.reload();
                  }}
                  aria-label="Обновить"
                >
                  <RefreshCw className={cn("size-4", avatar.loading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead
              title="Надето"
              action={
                (avatar.data?.wearing.length ?? 0) > 0 && (
                  <Button
                    size="sm"
                    variant="dangerSoft"
                    icon={<Eraser />}
                    loading={busyId === -1}
                    onClick={() => act("set", undefined, [])}
                  >
                    Снять всё
                  </Button>
                )
              }
            />
            <div className="mt-3 space-y-1.5">
              {avatar.loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              ) : (avatar.data?.wearing.length ?? 0) === 0 ? (
                <p className="rounded-2xl bg-card2 px-4 py-3 text-xs text-muted">
                  На аватаре только тело — надень что-нибудь справа.
                </p>
              ) : (
                avatar.data!.wearing.map((w) => (
                  <motion.div
                    key={w.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2.5 rounded-2xl bg-card2 px-2.5 py-2"
                  >
                    <Avatar src={w.image} name={w.name} size={34} rounded="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{w.name}</p>
                      <p className="truncate text-[10px] text-muted">{w.typeName}</p>
                    </div>
                    <button
                      onClick={() => act("remove", w.id)}
                      disabled={busyId === w.id}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-red-soft hover:text-red"
                      title="Снять"
                    >
                      {busyId === w.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* --------------------------- инвентарь --------------------------- */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-card2 p-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "h-8 shrink-0 whitespace-nowrap rounded-xl px-3 text-[13px] font-semibold transition-colors",
                    category === cat.id
                      ? "bg-card text-fg shadow-card"
                      : "text-muted hover:text-fg"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-40 flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск в инвентаре…"
                className="pl-10"
              />
            </div>
          </div>

          {inv.loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/3.6]" />
              ))}
            </div>
          ) : inv.error ? (
            <ErrorBox message={inv.error} onRetry={inv.reload} />
          ) : shownInv.length === 0 ? (
            <EmptyState
              icon={<Shirt />}
              title={query ? "Ничего не найдено" : "В этой категории пусто"}
              hint="Купленные и созданные вещи появятся здесь автоматически."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shownInv.map((item, i) => {
                const worn = wornIds.has(item.id);
                return (
                  <motion.button
                    key={`${item.typeId}-${item.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.35), duration: 0.2 }}
                    whileHover={{ y: -3 }}
                    onClick={() => act(worn ? "remove" : "wear", item.id)}
                    disabled={busyId === item.id}
                    className="text-left"
                  >
                    <Card
                      className={cn(
                        "overflow-hidden transition-shadow hover:shadow-pop",
                        worn && "ring-2 ring-accent"
                      )}
                    >
                      <div className="relative aspect-square bg-card2">
                        <Avatar src={item.image} name={item.name} fluid rounded="rounded-none" />
                        {worn && (
                          <span className="absolute right-2 top-2">
                            <Badge tone="accent" className="gap-1 shadow-card">
                              <Check className="size-3" /> надето
                            </Badge>
                          </span>
                        )}
                        {busyId === item.id && (
                          <span className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-sm">
                            <Loader2 className="size-5 animate-spin text-accent-strong" />
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-xs font-bold leading-tight">{item.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-muted">
                          {worn ? "нажми, чтобы снять" : "нажми, чтобы надеть"}
                        </p>
                      </div>
                    </Card>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="flex items-center gap-2 text-[11px] text-muted/80">
        <Sparkles className="size-3.5" />
        Надевание идёт через официальный avatar API — то же самое, что кнопка Wear на
        сайте Roblox.
      </p>
    </div>
  );
}
