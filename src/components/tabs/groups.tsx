"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  Check,
  Crown,
  ExternalLink,
  Handshake,
  Info,
  KeyRound,
  Loader2,
  Package2,
  PencilLine,
  Plus,
  Search,
  Shield,
  ShieldX,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { AccountInfo, GroupDetail, GroupEntry } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtCompact, fmtDateTime, fmtNum } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Modal,
  ModalHeader,
  RobuxValue,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";

/* ------------------------------ bits ------------------------------- */

function Editable({
  label,
  value,
  rows,
  onSave,
  disabled,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  rows?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  onSave: (v: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    setOk(false);
    const err = await onSave(draft);
    setBusy(false);
    if (err) setMsg(err);
    else {
      setOk(true);
      setTimeout(() => setOk(false), 2200);
    }
  };
  const dirty = draft !== value;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-soft">{label}</p>
        <AnimatePresence>
          {dirty && !disabled && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button size="sm" onClick={save} loading={busy} icon={<PencilLine />}>
                Сохранить
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {rows ? (
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled} placeholder={placeholder} />
      ) : (
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled} placeholder={placeholder} maxLength={120} />
      )}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
      {msg && <p className="text-[11px] font-semibold text-red">{msg}</p>}
      {ok && <p className="text-[11px] font-semibold text-green">Сохранено</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3 text-left transition-colors",
        !disabled && "hover:border-line-strong",
        disabled && "opacity-60"
      )}
    >
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          value ? "bg-green" : "bg-line-strong/60"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow",
            value ? "right-0.5" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
      {children}
    </motion.div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <ErrorBox message={message} onRetry={onRetry} />;
}

/* --------------------------- admin panes ---------------------------- */

interface MemberRow {
  userId: number;
  username: string;
  displayName: string;
  headshot: string | null;
  roleId: number;
  roleName: string;
  rank: number;
}
interface RoleLite {
  id: number;
  name: string;
  rank: number;
  memberCount?: number;
}

function MembersPane({ account, group }: { account: AccountInfo; group: GroupEntry }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyUser, setBusyUser] = useState<number | null>(null);
  const [kickConfirm, setKickConfirm] = useState<number | null>(null);

  const build = (cur?: string) => {
    const p = new URLSearchParams({ account: String(account.id), groupId: String(group.id), action: "members" });
    if (cur) p.set("cursor", cur);
    return `/api/roblox/group/manage?${p}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiFetch<{ members: MemberRow[]; roles: RoleLite[]; nextCursor: string | null }>(build());
      setMembers(d.members);
      setRoles(d.roles);
      setCursor(d.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, group.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    setMoreLoading(true);
    try {
      const d = await apiFetch<{ members: MemberRow[]; roles: RoleLite[]; nextCursor: string | null }>(build(cursor));
      setMembers((m) => [...m, ...d.members]);
      setCursor(d.nextCursor);
    } catch {} finally {
      setMoreLoading(false);
    }
  };

  const manage = async (action: string, extra: Record<string, unknown>) => {
    setBusyUser((extra.userId as number) ?? null);
    try {
      await apiFetch("/api/roblox/group/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, action, ...extra }),
      });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Ошибка";
    } finally {
      setBusyUser(null);
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (error) return <LoadError message={error} onRetry={load} />;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Загружено {members.length} из {fmtCompact(group.memberCount)} — крути «показать ещё».</p>
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-card2">
          <Avatar src={m.headshot} name={m.username} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{m.displayName}</p>
            <p className="truncate text-[11px] text-muted">@{m.username}</p>
          </div>
          {group.isOwner && m.rank < 255 ? (
            <>
              <Select
                className="w-36"
                value={String(m.roleId)}
                disabled={busyUser === m.userId}
                onChange={async (e) => {
                  const err = await manage("set-role", { userId: m.userId, roleId: Number(e.target.value) });
                  if (err) alert(err);
                  else void load();
                }}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.rank}
                  </option>
                ))}
              </Select>
              <button
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
                  kickConfirm === m.userId ? "bg-red-soft text-red" : "text-muted hover:bg-red-soft hover:text-red"
                )}
                disabled={busyUser === m.userId}
                onClick={async () => {
                  if (kickConfirm === m.userId) {
                    const err = await manage("kick", { userId: m.userId });
                    if (err) alert(err);
                    else {
                      setMembers((ms) => ms.filter((x) => x.userId !== m.userId));
                    }
                    setKickConfirm(null);
                  } else {
                    setKickConfirm(m.userId);
                    setTimeout(() => setKickConfirm((v) => (v === m.userId ? null : v)), 3000);
                  }
                }}
                title={kickConfirm === m.userId ? "Точно выгнать?" : "Выгнать"}
              >
                {busyUser === m.userId ? <Loader2 className="size-4 animate-spin" /> : <UserRoundX className="size-4" />}
              </button>
            </>
          ) : (
            <Badge tone={m.rank >= 254 ? "accent" : m.rank >= 100 ? "blue" : "neutral"}>{m.roleName}</Badge>
          )}
        </div>
      ))}
      {cursor && (
        <div className="pt-1 text-center">
          <Button variant="outline" size="sm" onClick={more} loading={moreLoading}>
            Показать ещё
          </Button>
        </div>
      )}
    </div>
  );
}

function RequestsPane({ account, group }: { account: AccountInfo; group: GroupEntry }) {
  const [reqs, setReqs] = useState<{ userId: number; username: string; displayName: string; headshot: string | null; created: string }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const d = await apiFetch<{ requests: typeof reqs }>(
        `/api/roblox/group/manage?account=${account.id}&groupId=${group.id}&action=join-requests`
      );
      setReqs(d.requests);
      setState(d.requests.length ? "ok" : "empty" as never);
      setState("ok");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
      setState("err");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, group.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (userId: number, accept: boolean) => {
    setBusy(userId);
    try {
      await apiFetch("/api/roblox/group/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, action: "join-handle", userId, accept }),
      });
      setReqs((r) => r.filter((x) => x.userId !== userId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") return <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (state === "err") return <LoadError message={err} onRetry={load} />;
  if (!reqs.length)
    return <p className="rounded-2xl bg-card2 px-4 py-3 text-xs text-muted">Заявок на вступление нет — всё чисто.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-soft">Заявки на вступление · {reqs.length}</p>
      {reqs.map((r) => (
        <div key={r.userId} className="flex items-center gap-3 rounded-2xl bg-card2 px-3 py-2.5">
          <Avatar src={r.headshot} name={r.username} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{r.displayName}</p>
            <p className="truncate text-[11px] text-muted">@{r.username} · {fmtDateTime(r.created)}</p>
          </div>
          <Button size="sm" variant="soft" disabled={busy === r.userId} onClick={() => act(r.userId, true)} icon={<UserRoundCheck />}>
            Принять
          </Button>
          <Button size="sm" variant="dangerSoft" disabled={busy === r.userId} onClick={() => act(r.userId, false)} icon={<UserRoundX />}>
            Отклонить
          </Button>
        </div>
      ))}
    </div>
  );
}

function RolesPane({ account, group, roles }: { account: AccountInfo; group: GroupEntry; roles: RoleLite[] }) {
  const [list, setList] = useState<RoleLite[]>(roles);
  const [newName, setNewName] = useState("");
  const [newRank, setNewRank] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRank, setEditRank] = useState("1");

  useEffect(() => setList(roles), [roles]);

  const call = async (action: string, extra: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await apiFetch("/api/roblox/group/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, action, ...extra }),
      });
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setErr(msg);
      return msg;
    } finally {
      setBusy(false);
    }
  };

  if (!group.isOwner) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {list.map((r) => (
          <Badge key={r.id} tone={r.rank >= 254 ? "accent" : "neutral"}>
            {r.name} · {r.rank} {typeof r.memberCount === "number" && `(${fmtCompact(r.memberCount)})`}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Новая роль" className="h-10 max-w-44" />
        <Input value={newRank} onChange={(e) => setNewRank(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Ранг" className="h-10 w-20" />
        <Button
          size="md"
          loading={busy}
          disabled={!newName.trim() || !newRank}
          icon={<Plus />}
          onClick={async () => {
            const e = await call("create-role", { name: newName.trim(), rank: Number(newRank) });
            if (!e) {
              setList((l) => [...l, { id: Date.now(), name: newName.trim(), rank: Number(newRank), memberCount: 0 }]);
              setNewName("");
            }
          }}
        >
          Создать
        </Button>
      </div>
      {err && <LoadError message={err} />}
      <div className="space-y-1.5">
        {list.map((r) => {
          const locked = r.rank >= 254 || r.rank === 0;
          const editing = editId === r.id;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card2 px-3.5 py-2.5">
              {editing ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 max-w-40 text-xs" />
                  <Input value={editRank} onChange={(e) => setEditRank(e.target.value.replace(/[^0-9]/g, ""))} className="h-9 w-20 text-xs" />
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={async () => {
                      const e = await call("update-role", { roleId: r.id, name: editName, rank: Number(editRank) });
                      if (!e) {
                        setList((l) => l.map((x) => (x.id === r.id ? { ...x, name: editName, rank: Number(editRank) } : x)));
                        setEditId(null);
                      }
                    }}
                    icon={<Check />}
                  >
                    Сохранить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)} icon={<X />}>
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">
                    {r.name}
                    <span className="ml-2 text-[11px] font-semibold text-muted">ранг {r.rank}{typeof r.memberCount === "number" ? ` · ${fmtCompact(r.memberCount)} чел.` : ""}</span>
                  </p>
                  {!locked && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<PencilLine />}
                        onClick={() => {
                          setEditId(r.id);
                          setEditName(r.name);
                          setEditRank(String(r.rank));
                        }}
                      >
                        Правка
                      </Button>
                      <Button
                        size="sm"
                        variant="dangerSoft"
                        icon={<Trash2 />}
                        loading={busy && editId === r.id}
                        onClick={async () => {
                          const e = await call("delete-role", { roleId: r.id });
                          if (!e) setList((l) => l.filter((x) => x.id !== r.id));
                        }}
                      >
                        Удалить
                      </Button>
                    </>
                  )}
                  {locked && <Badge tone="neutral">системная</Badge>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelationsPane({ account, group }: { account: AccountInfo; group: GroupEntry }) {
  const [data, setData] = useState<{ allies: { id: number; name: string; memberCount: number }[]; enemies: { id: number; name: string; memberCount: number }[] } | null>(null);
  const [err, setErr] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<NonNullable<typeof data>>(
        `/api/roblox/group/manage?account=${account.id}&groupId=${group.id}&action=relations`
      );
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, group.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (verb: "ally" | "enemy", mode: "add" | "remove", targetId: number) => {
    setBusy(true);
    setErr("");
    try {
      await apiFetch("/api/roblox/group/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, action: "relationship", verb, mode, targetId }),
      });
      setTarget("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (err && !data) return <LoadError message={err} onRetry={load} />;
  if (!data) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  const Col = ({ title, icon, items, verb }: { title: string; icon: React.ReactNode; items: { id: number; name: string; memberCount: number }[]; verb: "ally" | "enemy" }) => (
    <div className="space-y-2 rounded-2xl bg-card2 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-soft">
        {icon}
        {title} · {items.length}
      </p>
      {items.length === 0 && <p className="text-[11px] text-muted">Пусто</p>}
      {items.map((g) => (
        <div key={g.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{g.name}</p>
            <p className="text-[10px] text-muted">{fmtCompact(g.memberCount)} участников</p>
          </div>
          <button className="text-muted transition-colors hover:text-red" disabled={busy} onClick={() => act(verb, "remove", g.id)} title="Разорвать">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {err && <LoadError message={err} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Col title="Союзники" icon={<Handshake className="size-3.5" />} items={data.allies} verb="ally" />
        <Col title="Противники" icon={<ShieldX className="size-3.5" />} items={data.enemies} verb="enemy" />
      </div>
      <div className="flex items-center gap-2">
        <Input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="ID группы" className="h-10 max-w-44" />
        <Button size="md" variant="outline" disabled={!target || busy} onClick={() => act("ally", "add", Number(target))}>
          В союзники
        </Button>
        <Button size="md" variant="outline" disabled={!target || busy} onClick={() => act("enemy", "add", Number(target))}>
          В противники
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ modal ------------------------------ */

type PaneId = "about" | "settings" | "money" | "members" | "roles" | "relations";

function GroupModal({ account, group, onClose }: { account: AccountInfo; group: GroupEntry; onClose: () => void }) {
  const [pane, setPane] = useState<PaneId>("about");
  const detail = useRoblox<GroupDetail>(() => `/api/roblox/group?account=${account.id}&groupId=${group.id}`, [account.id, group.id]);

  const update = async (field: string, value: string): Promise<string | null> => {
    try {
      await apiFetch("/api/roblox/group/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, field, value }),
      });
      detail.reload();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Ошибка сохранения";
    }
  };

  const manageSettings = async (patch: Record<string, boolean>) => {
    try {
      await apiFetch("/api/roblox/group/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId: group.id, action: "settings", ...patch }),
      });
      detail.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
      detail.reload();
    }
  };

  const goAnalytics = () => {
    try {
      sessionStorage.setItem("hz:analytics-group", String(group.id));
    } catch {}
    window.dispatchEvent(new CustomEvent("hz:goto", { detail: { tab: "analytics" } }));
    onClose();
  };

  const d = detail.data;
  const canEdit = group.isOwner;

  const panes = (
    [
      { id: "about", label: "Обзор" },
      { id: "settings", label: "Настройки" },
      { id: "money", label: "Средства", owner: true },
      { id: "members", label: "Участники" },
      { id: "roles", label: "Роли" },
      { id: "relations", label: "Партнёры", owner: true },
    ] as { id: PaneId; label: string; owner?: boolean }[]
  ).filter((p) => !p.owner || canEdit);

  return (
    <Modal open onClose={onClose} className="max-w-2xl" labeledBy="group-modal">
      <ModalHeader onClose={onClose} title={group.name}>
        <div className="flex items-center gap-3.5">
          <Avatar src={d?.icon ?? group.icon} name={group.name} size={52} rounded="rounded-2xl" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-base font-extrabold tracking-tight">
              {group.name}
              {group.hasVerifiedBadge && <BadgeCheck className="size-4 shrink-0 text-blue" />}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {fmtNum(d?.memberCount ?? group.memberCount)}
              </span>
              <span>·</span>
              <span>ID {group.id}</span>
              {canEdit && (
                <Badge tone="accent">
                  <Crown className="size-3" /> Ты владелец
                </Badge>
              )}
            </p>
          </div>
        </div>
      </ModalHeader>

      <div className="no-scrollbar flex gap-1 overflow-x-auto px-6 pt-4">
        {panes.map((p) => (
          <button
            key={p.id}
            onClick={() => setPane(p.id)}
            className={cn(
              "h-8 shrink-0 rounded-xl px-3.5 text-[13px] font-semibold transition-colors",
              pane === p.id ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-card2 hover:text-fg"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="max-h-[54vh] min-h-80 overflow-y-auto px-6 py-5">
        {pane === "about" && (
          <Pane>
            {detail.loading && !d ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-10" />
                <Skeleton className="h-28" />
              </div>
            ) : detail.error ? (
              <LoadError message={detail.error} onRetry={detail.reload} />
            ) : d ? (
              <>
                {d.funds !== null && (
                  <button
                    onClick={goAnalytics}
                    className="flex w-full items-center justify-between rounded-2xl bg-accent-soft px-5 py-4 text-left transition-transform active:scale-[.99]"
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent-strong/70">Средства группы</p>
                      <RobuxValue value={d.funds} className="mt-0.5 text-xl text-accent-strong" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong">
                      <BarChart3 className="size-3.5" /> Аналитика продаж
                    </span>
                  </button>
                )}
                {d.shout?.body && (
                  <div className="rounded-2xl border border-line bg-card2 px-4 py-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Объявление · {d.shout.poster}</p>
                    <p className="mt-1.5 text-sm text-soft">{d.shout.body}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-soft">Описание</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-soft">{d.description || "Без описания"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-2xl bg-card2 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Владелец</p>
                    <p className="mt-1 truncate text-sm font-bold">{d.owner?.displayName ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-card2 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Вход</p>
                    <p className="mt-1 text-sm font-bold">{d.publicEntryAllowed ? "Открытый" : "По заявкам"}</p>
                  </div>
                  <div className="rounded-2xl bg-card2 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Твой ранг</p>
                    <p className="mt-1 text-sm font-bold">{group.role.name} · {group.role.rank}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`https://www.roblox.com/communities/${group.id}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" icon={<ExternalLink />}>
                      Открыть в Roblox
                    </Button>
                  </a>
                  <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noreferrer">
                    <Button variant="soft" size="sm" icon={<Package2 />}>
                      Новый предмет (Creator Hub)
                    </Button>
                  </a>
                </div>
              </>
            ) : null}
          </Pane>
        )}

        {pane === "settings" && (
          <Pane>
            {detail.loading && !d ? (
              <Skeleton className="h-40" />
            ) : d ? (
              <>
                <Editable
                  label="Название группы"
                  value={d.name}
                  disabled={!canEdit}
                  hint={canEdit ? "3–50 символов, сохранит сразу на roblox.com" : "Менять может только владелец (254)"}
                  onSave={(v) => update("name", v)}
                />
                <Editable label="Описание" value={d.description} rows disabled={!canEdit} onSave={(v) => update("description", v)} />
                <Editable
                  label="Объявление (shout)"
                  value=""
                  disabled={!canEdit}
                  placeholder="Уйдёт всем участникам в ленту группы…"
                  onSave={(v) => update("status", v)}
                />
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-soft">Права группы</p>
                  <Toggle
                    label="Открытый вход"
                    hint="Любой может вступить без заявки"
                    value={d.publicEntryAllowed}
                    disabled={!canEdit}
                    onChange={(v) => manageSettings({ publicEntryAllowed: v })}
                  />
                  <Toggle
                    label="Разрешить противников"
                    hint="Можно объявлять враждебные отношения другим группам"
                    value={!d.isLocked}
                    disabled
                    onChange={() => {}}
                  />
                </div>
              </>
            ) : null}
          </Pane>
        )}

        {pane === "money" && (
          <Pane>
            <RevenuePane account={account} group={group} onAnalytics={goAnalytics} />
          </Pane>
        )}

        {pane === "members" && (
          <Pane>
            {canEdit && <RequestsPane account={account} group={group} />}
            <MembersPane account={account} group={group} />
          </Pane>
        )}

        {pane === "roles" && (
          <Pane>
            <RolesPane account={account} group={group} roles={detail.data?.roles ?? []} />
          </Pane>
        )}

        {pane === "relations" && (
          <Pane>
            <RelationsPane account={account} group={group} />
          </Pane>
        )}
      </div>
    </Modal>
  );
}

function RevenuePane({ account, group, onAnalytics }: { account: AccountInfo; group: GroupEntry; onAnalytics: () => void }) {
  const rev = useRoblox<{ funds: number; pending: number }>(
    () => `/api/roblox/group/manage?account=${account.id}&groupId=${group.id}&action=revenue`,
    [account.id, group.id]
  );
  if (rev.loading) return <Skeleton className="h-32" />;
  if (rev.error) return <LoadError message={rev.error} onRetry={rev.reload} />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-green-soft text-green">
            <Wallet className="size-4.5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">На счету</p>
            <RobuxValue value={rev.data?.funds ?? null} className="text-lg" />
          </div>
        </Card>
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-amber-soft text-amber">
            <KeyRound className="size-4.5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Ожидают перевода</p>
            <RobuxValue value={rev.data?.pending ?? null} className="text-lg" />
          </div>
        </Card>
      </div>
      <Button variant="soft" onClick={onAnalytics} icon={<BarChart3 />}>
        Полная аналитика продаж
      </Button>
      <p className="text-[11px] leading-relaxed text-muted">«Ожидают перевода» — продажи за последние ~100 транзакций, которые ещё в escrow. Детальный график по дням смотри во вкладке «Аналитика».</p>
    </div>
  );
}

/* ------------------------------ cards ------------------------------ */

function GroupCard({ g, i, onOpen }: { g: GroupEntry; i: number; onOpen: () => void }) {
  return (
    <motion.button onClick={onOpen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.45), duration: 0.25 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} className="w-full text-left">
      <Card className="flex h-full items-center gap-3.5 p-4 transition-shadow duration-200 hover:shadow-pop">
        <Avatar src={g.icon} name={g.name} size={52} rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-bold leading-tight">
            <span className="truncate">{g.name}</span>
            {g.hasVerifiedBadge && <BadgeCheck className="size-3.5 shrink-0 text-blue" />}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
            <Users className="size-3" /> {fmtCompact(g.memberCount)} участников
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {g.isOwner ? (
              <Badge tone="accent">
                <Crown className="size-3" /> Владелец
              </Badge>
            ) : (
              <Badge tone="neutral">{g.role.name} · {g.role.rank}</Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.button>
  );
}

/* ------------------------------- tab ------------------------------- */

type RankFilter = "all" | "owned" | "member";

export default function GroupsTab({ account }: { account: AccountInfo }) {
  const groups = useRoblox<{ groups: GroupEntry[] }>(() => `/api/roblox/groups?account=${account.id}`, [account.id]);
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState<RankFilter>("all");
  const [openGroup, setOpenGroup] = useState<GroupEntry | null>(null);
  const [menu, setMenu] = useState(0);
  void setMenu;

  const list = useMemo(() => {
    let g = groups.data?.groups ?? [];
    if (rank === "owned") g = g.filter((x) => x.isOwner);
    if (rank === "member") g = g.filter((x) => !x.isOwner);
    const q = query.trim().toLowerCase();
    if (q) g = g.filter((x) => x.name.toLowerCase().includes(q));
    return g;
  }, [groups.data, query, rank]);

  const ownedCount = (groups.data?.groups ?? []).filter((g) => g.isOwner).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по группе…" className="pl-10" />
        </div>
        <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-card2 p-1">
          {(
            [
              { id: "all", label: "Все" },
              { id: "owned", label: `Мои (${ownedCount})` },
              { id: "member", label: "Где участник" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setRank(t.id)}
              className={cn("relative h-8 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold transition-colors", rank === t.id ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {groups.loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : groups.error ? (
        <ErrorBox message={groups.error} onRetry={groups.reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={rank === "owned" ? <Shield /> : <Users />}
          title={query ? "Ничего не нашлось" : rank === "owned" ? "Ты пока не владеешь группами" : "Групп нет"}
          hint={rank === "owned" ? "Группы с твоим рангом 254+ появятся здесь — их можно будет настраивать прямо отсюда." : "Вступи в группы на Roblox, и они появятся здесь автоматически."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g, i) => (
            <GroupCard key={g.id} g={g} i={i} onOpen={() => setOpenGroup(g)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {openGroup && <GroupModal account={account} group={openGroup} onClose={() => setOpenGroup(null)} />}
      </AnimatePresence>
      <Info className="hidden" />
    </div>
  );
}
