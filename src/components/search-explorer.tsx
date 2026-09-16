"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  ExternalLink,
  Gamepad2,
  Heart,
  LogIn,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  UserRound,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import type { AccountInfo } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtCompact, fmtDate, fmtNum } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  RobuxValue,
  SectionHead,
  Skeleton,
} from "@/components/ui";

export type SearchKind = "games" | "users" | "groups";

export interface ExplorerTarget {
  kind: SearchKind;
  query: string;
}
export interface DetailTarget {
  kind: "game" | "user" | "group";
  id: number;
  title?: string;
}

const KIND_LABEL: Record<SearchKind, string> = {
  games: "Игры",
  users: "Игроки",
  groups: "Группы",
};

/* ----------------------------- Frame shell ---------------------------- */

function Frame({
  title,
  subtitle,
  onBack,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (onBack ? onBack() : onClose());
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onBack, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-scene"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-card/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        {onBack ? (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Назад">
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold tracking-tight">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl pb-16">{children}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------ List frame ---------------------------- */

export function SearchListFrame({
  account,
  target,
  onOpen,
  onClose,
}: {
  account: AccountInfo;
  target: ExplorerTarget;
  onOpen: (d: DetailTarget) => void;
  onClose: () => void;
}) {
  const res = useRoblox<{
    games?: { universeId: number; placeId: number; name: string; creator: string; playing: number | null; thumb: string | null }[];
    users?: { id: number; name: string; displayName: string; headshot: string | null }[];
    groups?: { id: number; name: string; memberCount: number; icon: string | null; description: string }[];
  }>(
    () =>
      `/api/roblox/search?account=${account.id}&kind=${target.kind}&limit=50&q=${encodeURIComponent(
        target.query
      )}`,
    [account.id, target.kind, target.query]
  );

  const empty =
    !res.loading &&
    !(res.data?.games?.length || res.data?.users?.length || res.data?.groups?.length);

  return (
    <Frame
      title={`${KIND_LABEL[target.kind]} · «${target.query}»`}
      subtitle="Выбери результат, чтобы открыть подробности"
      onClose={onClose}
    >
      {res.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : empty ? (
        <EmptyState icon={<UserRound />} title="Ничего не нашлось" hint="Попробуй другой запрос." />
      ) : target.kind === "games" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {res.data!.games!.map((g, i) => (
            <motion.button
              key={g.universeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              whileHover={{ y: -3 }}
              onClick={() => onOpen({ kind: "game", id: g.universeId, title: g.name })}
              className="text-left"
            >
              <Card className="overflow-hidden transition-shadow hover:shadow-pop">
                <div className="aspect-square bg-card2">
                  <Avatar src={g.thumb} name={g.name} fluid rounded="rounded-none" />
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-bold">{g.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {g.playing !== null ? `${fmtCompact(g.playing)} играют` : g.creator}
                  </p>
                </div>
              </Card>
            </motion.button>
          ))}
        </div>
      ) : target.kind === "users" ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {res.data!.users!.map((u, i) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              whileHover={{ y: -2 }}
              onClick={() => onOpen({ kind: "user", id: u.id, title: u.displayName })}
              className="text-left"
            >
              <Card className="flex items-center gap-3 p-3.5 transition-shadow hover:shadow-pop">
                <Avatar src={u.headshot} name={u.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.displayName}</p>
                  <p className="truncate text-[11px] text-muted">@{u.name}</p>
                </div>
              </Card>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {res.data!.groups!.map((g, i) => (
            <motion.button
              key={g.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              whileHover={{ y: -2 }}
              onClick={() => onOpen({ kind: "group", id: g.id, title: g.name })}
              className="text-left"
            >
              <Card className="flex items-center gap-3 p-3.5 transition-shadow hover:shadow-pop">
                <Avatar src={g.icon} name={g.name} size={48} rounded="rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{g.name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {fmtCompact(g.memberCount)} участников
                  </p>
                </div>
              </Card>
            </motion.button>
          ))}
        </div>
      )}
    </Frame>
  );
}

/* ----------------------------- Detail frame --------------------------- */

interface UserDetail {
  kind: "user";
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  avatar: string | null;
  friends: number;
  followers: number;
  following: number;
  presence: number;
  location: string;
  isSelf: boolean;
  friendStatus: string;
  groups: { id: number; name: string; memberCount: number; icon: string | null }[];
}
interface GroupDetailFull {
  kind: "group";
  id: number;
  name: string;
  description: string;
  memberCount: number;
  icon: string | null;
  hasVerifiedBadge: boolean;
  owner: { userId: number; username: string; displayName: string } | null;
  shout: { body: string; poster: string } | null;
  isMember: boolean;
  games: { universeId: number; placeId: number; name: string; visits: number; thumb: string | null }[];
  store: { id: number; name: string; price: number | null; image: string | null }[];
}
interface GameDetail {
  kind: "game";
  universeId: number;
  placeId: number;
  name: string;
  description: string;
  creator: string;
  creatorType: string;
  creatorId: number;
  playing: number;
  visits: number;
  maxPlayers: number;
  favorites: number;
  upVotes: number;
  downVotes: number;
  created: string;
  updated: string;
  icon: string | null;
  media: string[];
}
type AnyDetail = UserDetail | GroupDetailFull | GameDetail;

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card2 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 text-base font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

export function DetailFrame({
  account,
  target,
  onBack,
  onClose,
  onOpen,
}: {
  account: AccountInfo;
  target: DetailTarget;
  onBack?: () => void;
  onClose: () => void;
  onOpen: (d: DetailTarget) => void;
}) {
  const res = useRoblox<AnyDetail>(
    () => `/api/roblox/profile?account=${account.id}&kind=${target.kind}&id=${target.id}`,
    [account.id, target.kind, target.id]
  );
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setErr("");
    setNote("");
    try {
      await apiFetch("/api/roblox/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, id: target.id, action, ...extra }),
      });
      setNote("Готово");
      res.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy("");
    }
  };

  const d = res.data;

  return (
    <Frame
      title={target.title ?? "Загрузка…"}
      subtitle={
        target.kind === "game" ? "Игра" : target.kind === "user" ? "Игрок" : "Группа"
      }
      onBack={onBack}
      onClose={onClose}
    >
      {res.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !d ? null : (
        <div className="space-y-5">
          {err && <ErrorBox message={err} />}
          {note && (
            <div className="rounded-2xl bg-green-soft px-4 py-2.5 text-xs font-bold text-green">
              {note}
            </div>
          )}

          {/* ------------------------------ игрок ---------------------------- */}
          {d.kind === "user" && (
            <>
              <Card className="relative overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent-soft blur-2xl" />
                <div className="relative flex flex-wrap items-center gap-5">
                  <Avatar src={d.avatar} name={d.name} size={110} rounded="rounded-[1.75rem]" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-extrabold tracking-tight">{d.displayName}</h2>
                    <p className="text-sm text-muted">@{d.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {d.presence === 2 ? (
                        <Badge tone="blue">в игре · {d.location || "играет"}</Badge>
                      ) : d.presence === 1 ? (
                        <Badge tone="green">в сети</Badge>
                      ) : (
                        <Badge tone="neutral">не в сети</Badge>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Calendar className="size-3" /> с {fmtDate(d.created)}
                      </span>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-2.5 sm:w-auto sm:min-w-80">
                    <StatBox label="Друзья" value={fmtCompact(d.friends)} />
                    <StatBox label="Подписчики" value={fmtCompact(d.followers)} />
                    <StatBox label="Подписки" value={fmtCompact(d.following)} />
                  </div>
                </div>
                {!d.isSelf && (
                  <div className="relative mt-4 flex flex-wrap gap-2">
                    {d.friendStatus === "Friends" ? (
                      <Button
                        variant="dangerSoft"
                        loading={busy === "unfriend"}
                        onClick={() => act("unfriend")}
                        icon={<UserRoundCheck />}
                      >
                        Убрать из друзей
                      </Button>
                    ) : (
                      <Button
                        loading={busy === "friend-request"}
                        onClick={() => act("friend-request")}
                        icon={<UserPlus />}
                      >
                        {d.friendStatus === "RequestSent" ? "Запрос отправлен" : "Добавить в друзья"}
                      </Button>
                    )}
                    <Button
                      variant="soft"
                      loading={busy === "follow"}
                      onClick={() => act("follow")}
                    >
                      Подписаться
                    </Button>
                    <a
                      href={`https://www.roblox.com/users/${d.id}/profile`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button variant="outline" icon={<ExternalLink />}>
                        Профиль
                      </Button>
                    </a>
                  </div>
                )}
              </Card>

              {d.description && (
                <Card className="p-5">
                  <SectionHead title="О себе" />
                  <p className="mt-2 whitespace-pre-wrap text-sm text-soft">{d.description}</p>
                </Card>
              )}

              {d.groups.length > 0 && (
                <div>
                  <SectionHead title="Группы" />
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {d.groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => onOpen({ kind: "group", id: g.id, title: g.name })}
                        className="text-left"
                      >
                        <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-pop">
                          <Avatar src={g.icon} name={g.name} size={40} rounded="rounded-xl" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold">{g.name}</p>
                            <p className="text-[10px] text-muted">
                              {fmtCompact(g.memberCount)} участников
                            </p>
                          </div>
                        </Card>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ------------------------------ группа --------------------------- */}
          {d.kind === "group" && (
            <>
              <Card className="relative overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent-soft blur-2xl" />
                <div className="relative flex flex-wrap items-center gap-5">
                  <Avatar src={d.icon} name={d.name} size={100} rounded="rounded-[1.5rem]" />
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                      {d.name}
                      {d.hasVerifiedBadge && <BadgeCheck className="size-5 text-blue" />}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Владелец: {d.owner?.displayName ?? "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.isMember ? (
                        <Button
                          variant="dangerSoft"
                          loading={busy === "leave-group"}
                          onClick={() => act("leave-group")}
                        >
                          Выйти из группы
                        </Button>
                      ) : (
                        <Button
                          loading={busy === "join-group"}
                          onClick={() => act("join-group")}
                          icon={<UserPlus />}
                        >
                          Вступить
                        </Button>
                      )}
                      <a
                        href={`https://www.roblox.com/communities/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" icon={<ExternalLink />}>
                          Открыть
                        </Button>
                      </a>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:min-w-56">
                    <StatBox label="Участники" value={fmtCompact(d.memberCount)} />
                    <StatBox label="Игры" value={d.games.length} />
                  </div>
                </div>
              </Card>

              {d.shout && (
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Объявление · {d.shout.poster}
                  </p>
                  <p className="mt-1.5 text-sm text-soft">{d.shout.body}</p>
                </Card>
              )}

              {d.description && (
                <Card className="p-5">
                  <SectionHead title="Описание" />
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-soft">
                    {d.description}
                  </p>
                </Card>
              )}

              {d.games.length > 0 && (
                <div>
                  <SectionHead title="Игры группы" />
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {d.games.map((g) => (
                      <button
                        key={g.universeId}
                        onClick={() => onOpen({ kind: "game", id: g.universeId, title: g.name })}
                        className="text-left"
                      >
                        <Card className="overflow-hidden transition-shadow hover:shadow-pop">
                          <div className="aspect-square bg-card2">
                            <Avatar src={g.thumb} name={g.name} fluid rounded="rounded-none" />
                          </div>
                          <div className="p-2.5">
                            <p className="truncate text-xs font-bold">{g.name}</p>
                            <p className="text-[10px] text-muted">
                              {fmtCompact(g.visits)} посещений
                            </p>
                          </div>
                        </Card>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {d.store.length > 0 && (
                <div>
                  <SectionHead title="Одежда группы" />
                  <div className="no-scrollbar -mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                    {d.store.map((s) => (
                      <a
                        key={s.id}
                        href={`https://www.roblox.com/catalog/${s.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-32 shrink-0 snap-start"
                      >
                        <Card className="overflow-hidden transition-shadow hover:shadow-pop">
                          <div className="aspect-square bg-card2">
                            <Avatar src={s.image} name={s.name} fluid rounded="rounded-none" />
                          </div>
                          <div className="p-2">
                            <p className="truncate text-[11px] font-bold">{s.name}</p>
                            {s.price !== null && (
                              <RobuxValue value={s.price} className="text-[11px]" />
                            )}
                          </div>
                        </Card>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ------------------------------- игра ---------------------------- */}
          {d.kind === "game" && (
            <>
              <Card className="overflow-hidden">
                {d.media[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.media[0]} alt={d.name} className="h-56 w-full object-cover sm:h-72" />
                )}
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar src={d.icon} name={d.name} size={72} rounded="rounded-2xl" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold tracking-tight">{d.name}</h2>
                      <button
                        onClick={() =>
                          d.creatorType === "Group"
                            ? onOpen({ kind: "group", id: d.creatorId, title: d.creator })
                            : onOpen({ kind: "user", id: d.creatorId, title: d.creator })
                        }
                        className="mt-0.5 text-xs font-semibold text-accent-strong hover:underline"
                      >
                        от {d.creator}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`roblox://experiences/start?placeId=${d.placeId}`}>
                        <Button icon={<LogIn />}>Войти в игру</Button>
                      </a>
                      <Button
                        variant="soft"
                        loading={busy === "favorite-game"}
                        onClick={() => act("favorite-game", { value: true })}
                        icon={<Heart />}
                      >
                        В избранное
                      </Button>
                      <a
                        href={`https://www.roblox.com/games/${d.placeId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" icon={<ExternalLink />}>
                          Страница
                        </Button>
                      </a>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <StatBox label="Сейчас играют" value={fmtNum(d.playing)} />
                    <StatBox label="Посещений" value={fmtCompact(d.visits)} />
                    <StatBox label="В избранном" value={fmtCompact(d.favorites)} />
                    <StatBox
                      label="Рейтинг"
                      value={
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span className="inline-flex items-center gap-1 text-green">
                            <ThumbsUp className="size-3.5" /> {fmtCompact(d.upVotes)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-red">
                            <ThumbsDown className="size-3.5" /> {fmtCompact(d.downVotes)}
                          </span>
                        </span>
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <Badge tone="neutral">
                      <Users className="size-3" /> до {d.maxPlayers} игроков
                    </Badge>
                    <Badge tone="neutral">обновлено {fmtDate(d.updated)}</Badge>
                    <Badge tone="neutral">создано {fmtDate(d.created)}</Badge>
                  </div>
                </div>
              </Card>

              {d.description && (
                <Card className="p-5">
                  <SectionHead title="Описание" />
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-soft">
                    {d.description}
                  </p>
                </Card>
              )}

              {d.media.length > 1 && (
                <div>
                  <SectionHead title="Скриншоты" />
                  <div className="no-scrollbar -mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                    {d.media.slice(1).map((m, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={m}
                        alt=""
                        className="h-40 w-72 shrink-0 snap-start rounded-2xl border border-line object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Frame>
  );
}

/* ---------------------------- Kind chooser ---------------------------- */

export function SearchKindMenu({
  query,
  counts,
  onPick,
}: {
  query: string;
  counts?: { games: number; users: number; groups: number };
  onPick: (k: SearchKind) => void;
}) {
  const rows: { kind: SearchKind; icon: React.ReactNode; label: string; n?: number }[] = [
    { kind: "games", icon: <Gamepad2 className="size-4" />, label: "Игру", n: counts?.games },
    { kind: "users", icon: <UserRound className="size-4" />, label: "Игрока", n: counts?.users },
    { kind: "groups", icon: <Users className="size-4" />, label: "Группу", n: counts?.groups },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.16 }}
      className="absolute inset-x-0 top-14 z-30 overflow-hidden rounded-3xl border border-line bg-card p-1.5 shadow-pop"
    >
      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
        Что искать по запросу «{query}»
      </p>
      {rows.map((r) => (
        <button
          key={r.kind}
          onClick={() => onPick(r.kind)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-card2"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-strong">
            {r.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{r.label}</span>
            <span className="block truncate text-[11px] text-muted">
              «{query}»
            </span>
          </span>
          {typeof r.n === "number" && r.n > 0 && (
            <Badge tone="neutral">{r.n}</Badge>
          )}
        </button>
      ))}
    </motion.div>
  );
}

export function ExplorerHost({
  account,
  list,
  detail,
  setList,
  setDetail,
  closeAll,
}: {
  account: AccountInfo;
  list: ExplorerTarget | null;
  detail: DetailTarget | null;
  setList: (v: ExplorerTarget | null) => void;
  setDetail: (v: DetailTarget | null) => void;
  closeAll: () => void;
}) {
  return (
    <AnimatePresence>
      {detail ? (
        <DetailFrame
          key="detail"
          account={account}
          target={detail}
          onBack={list ? () => setDetail(null) : undefined}
          onClose={closeAll}
          onOpen={(d) => setDetail(d)}
        />
      ) : list ? (
        <SearchListFrame
          key="list"
          account={account}
          target={list}
          onOpen={(d) => setDetail(d)}
          onClose={closeAll}
        />
      ) : null}
    </AnimatePresence>
  );
}

export { Frame };
export const cnHelper = cn;
