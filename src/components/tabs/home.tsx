"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Flame,
  Gamepad2,
  History,
  Radio,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { AccountInfo, FriendPresence, MeInfo } from "@/lib/types";
import { useRoblox } from "@/components/use-roblox";
import {
  ExplorerHost,
  SearchKindMenu,
  type DetailTarget,
  type ExplorerTarget,
  type SearchKind,
} from "@/components/search-explorer";
import { cn, fmtCompact, fmtDate, relTime } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Robux,
  SectionHead,
  Skeleton,
} from "@/components/ui";

const FRIENDS_PREVIEW = 5;

interface GameCard {
  universeId: number;
  placeId: number;
  name: string;
  creator: string;
  playing: number | null;
  thumb: string | null;
}

interface SearchResults {
  games: GameCard[];
  users: { id: number; name: string; displayName: string; headshot: string | null }[];
  groups: { id: number; name: string; memberCount: number; icon: string | null }[];
}

/* ----------------------------- helpers ----------------------------- */

function joinDeepLink(f: FriendPresence) {
  if (!f.placeId) return null;
  const q = new URLSearchParams({ placeId: String(f.placeId) });
  if (f.gameId) q.set("gameInstanceId", f.gameId);
  return `roblox://experiences/start?${q}`;
}

function JoinButton({ f }: { f: FriendPresence }) {
  const [copied, setCopied] = useState(false);
  const deep = joinDeepLink(f);
  const webId = f.rootPlaceId ?? f.placeId ?? "";
  if (!deep) return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <a
        href={deep}
        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-soft text-xs font-bold text-green transition-transform active:scale-95"
      >
        <Gamepad2 className="size-3.5" /> Зайти к ним
      </a>
      <button
        title="Скопировать ссылку на игру"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`https://www.roblox.com/games/${webId}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {}
        }}
        className="grid size-8 place-items-center rounded-xl bg-card2 text-muted transition-colors hover:text-fg"
      >
        {copied ? <Check className="size-3.5 text-green" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function FriendCard({ f, i }: { f: FriendPresence; i: number }) {
  const inGame = f.presence === 2;
  const online = f.presence === 1 || f.presence === 3;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.22 }}
      whileHover={{ y: -3 }}
    >
      <Card className={cn("p-3.5 transition-shadow hover:shadow-pop", !inGame && !online && "opacity-75")}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar src={f.headshot} name={f.name} size={44} />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card",
                inGame ? "bg-blue" : online ? "bg-green" : "bg-muted/40"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{f.displayName}</p>
            <p className="truncate text-[11px] text-muted">@{f.name}</p>
          </div>
        </div>
        <p className="mt-2.5 flex min-h-4 items-center gap-1.5 truncate text-[11px] font-medium text-muted">
          {inGame ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-blue" />
              <span className="truncate text-soft">{f.location || "В игре"}</span>
            </>
          ) : online ? (
            <>
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-green" />
              В сети
            </>
          ) : (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-muted/40" />
              {f.lastOnline ? `Был(а) ${relTime(f.lastOnline)}` : "Не в сети"}
            </>
          )}
        </p>
        {inGame && <JoinButton f={f} />}
      </Card>
    </motion.div>
  );
}

function GameTile({ g, i }: { g: GameCard; i: number }) {
  const href = g.placeId
    ? `https://www.roblox.com/games/${g.placeId}`
    : `https://www.roblox.com/games/start?universeId=${g.universeId}`;
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.22 }}
      whileHover={{ y: -4 }}
      className="group w-40 shrink-0 snap-start"
    >
      <Card className="overflow-hidden transition-shadow group-hover:shadow-pop">
        <div className="relative aspect-square bg-card2">
          <Avatar src={g.thumb} name={g.name} fluid rounded="rounded-none" />
          {g.placeId > 0 && (
            <a
              href={`roblox://experiences/start?placeId=${g.placeId}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-2 bottom-2 grid h-8 place-items-center rounded-xl bg-green/90 text-xs font-bold text-white opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100"
            >
              ▶ Играть
            </a>
          )}
        </div>
        <div className="p-2.5">
          <p className="truncate text-xs font-bold leading-tight">{g.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted">
            {g.playing !== null ? `${fmtCompact(g.playing)} играют` : g.creator || "Roblox"}
          </p>
        </div>
      </Card>
    </motion.a>
  );
}

function GameRail({ title, icon, games }: { title: string; icon: React.ReactNode; games: GameCard[] }) {
  if (!games.length) return null;
  return (
    <section>
      <SectionHead title={<><span className="[&>svg]:size-4">{icon}</span>{title}</>} />
      <div className="no-scrollbar -mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {games.map((g, i) => (
          <GameTile key={`${g.universeId}-${i}`} g={g} i={i} />
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string | number; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-card2 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={cn("mt-1 flex items-center gap-1.5 text-lg font-extrabold tracking-tight tabular-nums", accent && "text-accent-strong")}>
        {icon}
        {value}
      </p>
    </div>
  );
}

/* ------------------------------- tab ------------------------------- */

export default function HomeTab({ account }: { account: AccountInfo }) {
  const me = useRoblox<MeInfo>(() => `/api/roblox/me?account=${account.id}`, [account.id]);
  const friends = useRoblox<{
    friends: FriendPresence[];
    total: number;
    online: number;
    inGame: number;
  }>(() => `/api/roblox/friends?account=${account.id}`, [account.id]);
  const discover = useRoblox<{ recent: GameCard[]; popular: GameCard[]; trending: GameCard[] }>(
    () => `/api/roblox/discover?account=${account.id}`,
    [account.id]
  );

  const [showAllFriends, setShowAllFriends] = useState(false);

  // ---- универсальный поиск: сначала выбор «что искать», потом экраны
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [listTarget, setListTarget] = useState<ExplorerTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(draft.trim()), 450);
    return () => clearTimeout(t);
  }, [draft]);

  const preview = useRoblox<SearchResults & { counts?: { games: number; users: number; groups: number } }>(
    () =>
      query.length >= 2
        ? `/api/roblox/search?account=${account.id}&kind=counts&q=${encodeURIComponent(query)}`
        : null,
    [account.id, query]
  );

  useEffect(() => {
    setMenuOpen(query.length >= 2);
  }, [query]);

  const pickKind = (k: SearchKind) => {
    setMenuOpen(false);
    setListTarget({ kind: k, query });
  };

  const closeExplorer = () => {
    setListTarget(null);
    setDetailTarget(null);
  };

  const sortedFriends = friends.data?.friends ?? [];
  const visibleFriends = showAllFriends
    ? sortedFriends
    : sortedFriends.slice(0, FRIENDS_PREVIEW);
  const hiddenCount = Math.max(0, sortedFriends.length - FRIENDS_PREVIEW);

  return (
    <div className="space-y-6">
      {/* --------------------------- поиск --------------------------- */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => query.length >= 2 && setMenuOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.length >= 2) pickKind("games");
            if (e.key === "Escape") setMenuOpen(false);
          }}
          placeholder="Поиск игр, игроков и групп в Roblox…"
          className="h-12 pl-11 pr-10 text-[15px]"
        />
        {draft && (
          <button
            onClick={() => {
              setDraft("");
              setMenuOpen(false);
            }}
            aria-label="Очистить"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
        <AnimatePresence>
          {menuOpen && query.length >= 2 && (
            <SearchKindMenu
              query={query}
              counts={preview.data?.counts}
              onPick={pickKind}
            />
          )}
        </AnimatePresence>
      </div>

      {/* --------------------------- профиль --------------------------- */}
      {me.loading ? (
        <Card className="flex flex-wrap items-center gap-6 p-6">
          <Skeleton className="size-28 rounded-3xl" />
          <div className="w-64 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </Card>
      ) : me.error ? (
        <ErrorBox message={me.error} onRetry={me.reload} />
      ) : me.data ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent-soft blur-2xl" />
            <div className="relative flex flex-wrap items-center gap-6">
              <div className="relative">
                <Avatar src={me.data.headshot} name={me.data.displayName} size={112} rounded="rounded-[1.75rem]" />
                <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-[3px] border-card bg-green">
                  <Radio className="size-3 text-white" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{me.data.displayName}</h1>
                  <Badge tone="accent">это ты</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-muted">@{me.data.name}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> В Roblox с {fmtDate(me.data.created)}
                  </span>
                  <a
                    href={`https://www.roblox.com/users/${me.data.userId}/profile`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-accent-strong hover:underline"
                  >
                    Открыть профиль <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:grid-cols-4 lg:min-w-[430px]">
                <Stat label="Робуксы" value={fmtCompact(me.data.robux)} icon={<Robux className="size-4" />} accent />
                <Stat label="Друзья" value={fmtCompact(me.data.friends)} />
                <Stat label="Подписчики" value={fmtCompact(me.data.followers)} />
                <Stat label="Подписки" value={fmtCompact(me.data.following)} />
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {/* --------------------------- друзья --------------------------- */}
      <div>
        <SectionHead
          title={
            <>
              Друзья
              {friends.data && <Badge tone="neutral">{friends.data.total}</Badge>}
              {friends.data && friends.data.inGame > 0 && (
                <Badge tone="blue">{friends.data.inGame} в игре</Badge>
              )}
              {friends.data && friends.data.online > 0 && (
                <Badge tone="green">{friends.data.online} в сети</Badge>
              )}
            </>
          }
          action={
            <Button variant="outline" size="icon" onClick={friends.reload} aria-label="Обновить">
              <RefreshCw className={cn("size-4", friends.loading && "animate-spin")} />
            </Button>
          }
        />
        <div className="mt-4">
          {friends.loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : friends.error ? (
            <ErrorBox message={friends.error} onRetry={friends.reload} />
          ) : sortedFriends.length === 0 ? (
            <EmptyState icon={<Users />} title="Друзей пока нет" hint="Добавь друзей на Roblox — они появятся здесь со статусом в реальном времени." />
          ) : (
            <>
              <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <AnimatePresence initial={false}>
                  {visibleFriends.map((f, i) => (
                    <FriendCard key={f.id} f={f} i={i} />
                  ))}
                </AnimatePresence>
              </motion.div>
              {hiddenCount > 0 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllFriends((v) => !v)}
                    icon={
                      <ChevronDown
                        className={cn("transition-transform", showAllFriends && "rotate-180")}
                      />
                    }
                  >
                    {showAllFriends ? "Свернуть" : `Показать ещё ${hiddenCount}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ----------------------------- игры ----------------------------- */}
      {discover.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-5 w-44" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-40 shrink-0" />
            ))}
          </div>
        </div>
      ) : discover.error ? (
        <ErrorBox message={discover.error} onRetry={discover.reload} />
      ) : (
        <div className="space-y-6">
          <GameRail title="Ты недавно играл" icon={<History />} games={discover.data?.recent ?? []} />
          <GameRail title="Сейчас играют больше всего" icon={<Flame />} games={discover.data?.popular ?? []} />
          <GameRail title="Набирают популярность" icon={<TrendingUp />} games={discover.data?.trending ?? []} />
        </div>
      )}

      <ExplorerHost
        account={account}
        list={listTarget}
        detail={detailTarget}
        setList={setListTarget}
        setDetail={setDetailTarget}
        closeAll={closeExplorer}
      />
    </div>
  );
}
