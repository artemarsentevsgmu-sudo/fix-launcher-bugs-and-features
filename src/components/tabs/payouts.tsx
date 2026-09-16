"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleAlert,
  HandCoins,
  Plus,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type { AccountInfo, ChallengeState, GroupEntry, ResolvedUser } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtNum } from "@/lib/utils";
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
  Robux,
  RobuxValue,
  SectionHead,
  Segmented,
  Select,
  Skeleton,
} from "@/components/ui";

interface Row {
  key: number;
  username: string;
  amount: string;
}

interface Pending {
  groupId: string;
  recipients: { username: string; amount: number }[];
  challenge: ChallengeState;
}

/* ----------------------------- 2FA modal ---------------------------- */

function TwoFAModal({
  open,
  pending,
  account,
  onClose,
  onSuccess,
}: {
  open: boolean;
  pending: Pending | null;
  account: AccountInfo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [medium, setMedium] = useState<"authenticator" | "email">("authenticator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (open) {
      setCode("");
      setError("");
    }
  }, [open]);

  if (!pending) return null;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/roblox/payouts/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: account.id,
          groupId: pending.groupId,
          recipients: pending.recipients,
          challenge: pending.challenge,
          code,
          medium,
        }),
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подтверждения");
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} className="max-w-sm" labeledBy="twofa">
      <ModalHeader
        title="Roblox просит код двухфакторки"
        subtitle="Выплата на паузе, пока не подтвердишь"
        onClose={onClose}
      />
      <div className="space-y-4 px-6 py-5">
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-amber-soft text-amber">
            <ShieldCheck className="size-6" />
          </div>
          <Segmented
            className="mx-auto flex w-full justify-center"
            name="twofa-medium"
            value={medium}
            onChange={setMedium}
            items={[
              { id: "authenticator", label: "Приложение" },
              { id: "email", label: "Почта" },
            ]}
          />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && submit()}
            placeholder="000 000"
            inputMode="numeric"
            autoFocus
            className="h-14 text-center font-mono text-2xl font-bold tracking-[0.4em]"
          />
        </motion.div>
        {error && <ErrorBox message={error} />}
        <div className="rounded-2xl bg-card2 px-4 py-3 text-[11px] leading-relaxed text-muted">
          Отправляем{" "}
          <b className="text-fg">
            <RobuxValue value={pending.recipients.reduce((s, r) => s + r.amount, 0)} className="text-[11px]" />
          </b>{" "}
          — {pending.recipients.length} получат. Код нужен один раз, проверка через
          официальный challenge API Roblox.
        </div>
      </div>
      <div className="flex gap-2 border-t border-line px-6 py-4">
        <Button variant="ghost" onClick={onClose} disabled={busy} className="flex-1">
          Отмена
        </Button>
        <Button onClick={submit} loading={busy} disabled={code.length !== 6} className="flex-1">
          Подтвердить выплату
        </Button>
      </div>
    </Modal>
  );
}

/* --------------------------- Recipient row --------------------------- */

function RecipientRow({
  row,
  resolved,
  onChange,
  onRemove,
  canRemove,
}: {
  row: Row;
  resolved: ResolvedUser | undefined;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const name = row.username.trim();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2.5"
    >
      <div className="relative flex-1">
        <Input
          value={row.username}
          onChange={(e) => onChange({ username: e.target.value })}
          placeholder="Ник пользователя Roblox"
          className={cn(
            "pl-11",
            name && resolved && !resolved.ok && "border-red/50 focus:border-red/60"
          )}
          spellCheck={false}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          {name && resolved ? (
            resolved.ok ? (
              <Avatar src={resolved.headshot} name={resolved.username} size={26} />
            ) : (
              <XCircle className="size-4.5 text-red" />
            )
          ) : (
            <UserRound className="size-4.5 text-muted" />
          )}
        </span>
      </div>
      <div className="relative w-32">
        <Input
          value={row.amount}
          onChange={(e) => onChange({ amount: e.target.value.replace(/[^0-9]/g, "") })}
          placeholder="Сумма"
          inputMode="numeric"
          className="pl-9"
        />
        <Robux className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Убрать"
        className="shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </motion.div>
  );
}

/* --------------------------------- Tab -------------------------------- */

export default function PayoutsTab({ account }: { account: AccountInfo }) {
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

  const funds = useRoblox<{ funds: number }>(
    () => (groupId ? `/api/roblox/group/funds?account=${account.id}&groupId=${groupId}` : null),
    [account.id, groupId]
  );

  const keyRef = useRef(2);
  const [rows, setRows] = useState<Row[]>([
    { key: 0, username: "", amount: "" },
    { key: 1, username: "", amount: "" },
  ]);
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedUser>>({});
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  // Дебаунс: резолвим ники в пользователей
  const namesKey = rows.map((r) => r.username.trim().toLowerCase()).join("|");
  useEffect(() => {
    const names = namesKey.split("|").filter(Boolean);
    if (!names.length) {
      setResolvedMap({});
      return;
    }
    const t = setTimeout(async () => {
      setResolving(true);
      try {
        const data = await apiFetch<{ users: ResolvedUser[] }>("/api/roblox/resolve-users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account: account.id, usernames: names }),
        });
        const map: Record<string, ResolvedUser> = {};
        for (const u of data.users) map[u.requested.toLowerCase()] = u;
        setResolvedMap(map);
      } catch {
        /* не критично */
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [namesKey, account.id]);

  const validRows = rows
    .map((r) => ({ username: r.username.trim(), amount: Math.floor(Number(r.amount) || 0) }))
    .filter((r) => r.username && r.amount > 0);
  const total = validRows.reduce((s, r) => s + r.amount, 0);
  const unresolved = validRows.some(
    (r) => resolvedMap[r.username.toLowerCase()]?.ok === false
  );
  const overFunds = funds.data && total > funds.data.funds;

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () =>
    rows.length < 20 && setRows((rs) => [...rs, { key: keyRef.current++, username: "", amount: "" }]);

  const submit = async () => {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      // Здесь нужен статус 202 для 2FA, поэтому читаем ответ вручную, но без
      // res.json(): прокси иногда возвращает HTML и раньше ронял весь flow.
      const res = await fetch("/api/roblox/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, groupId, recipients: validRows }),
        signal: AbortSignal.timeout(45_000),
      });
      const raw = await res.text();
      let data: Record<string, any> = {};
      try {
        data = raw && !/^\s*</.test(raw) ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (/^\s*</.test(raw)) {
        throw new Error("Сервер вернул HTML вместо данных — Roblox долго отвечал, попробуй ещё раз");
      }
      if (res.status === 202) {
        setPending({
          groupId,
          recipients: validRows,
          challenge: data.challenge,
        });
      } else if (!res.ok) {
        throw new Error(data.error || `Ошибка выплаты (${res.status})`);
      } else {
        setSuccess(true);
        setRows([{ key: keyRef.current++, username: "", amount: "" }]);
        setResolvedMap({});
        funds.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка выплаты");
    } finally {
      setBusy(false);
    }
  };

  if (!groups.loading && owned.length === 0) {
    return (
      <EmptyState
        icon={<HandCoins />}
        title="Выплаты доступны владельцам групп"
        hint="На аккаунте нет групп с рангом 254+. Добавь куки владельца группы, из которой хочешь платить людям."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Send className="size-5 text-accent-strong" /> Выплаты робуксов
        </h1>
        <p className="mt-1 text-xs text-muted">
          Выбери группу, добавь ники и суммы — Roblox иногда попросит код 2FA, мы покажем
          окно и дождёмся его прямо здесь.
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-amber/20 bg-amber-soft px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-bold text-amber">
          <CircleAlert className="size-4 shrink-0" />
          Почему куки слетает именно на выплатах
        </p>
        <p className="text-[11px] leading-relaxed text-amber">
          С 2022 года Roblox <b>привязывает .ROBLOSECURITY к региону IP</b>. Лаунчер
          работает на сервере в другой стране, поэтому на «денежных» действиях
          (выплата) срабатывает антифрод и сессия гасится. Обычные запросы — чтение
          групп, цен, транзакций — проходят спокойно.
        </p>
        <p className="text-[11px] leading-relaxed text-amber">
          Я научил лаунчер <b>ловить ротацию куки</b>: если Roblox выдаёт новый токен,
          он теперь сразу сохраняется в базу, и сессия живёт дольше. Но обойти
          IP-привязку с чужого сервера нельзя — для стабильных выплат лаунчер нужно
          запускать на своём ПК (или через прокси своего региона), тогда куки
          перестанет слетать.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {owned.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-2.5 shadow-card sm:min-w-56">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              На счету группы
            </p>
            {funds.loading ? (
              <Skeleton className="mt-1 h-4 w-20 rounded-lg" />
            ) : funds.error ? (
              <p className="mt-1 text-[11px] font-semibold text-red">
                {funds.error}
              </p>
            ) : (
              <RobuxValue value={funds.data?.funds ?? null} className="text-lg" />
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={funds.reload} aria-label="Обновить">
            <RefreshCw className={cn("size-4", funds.loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <SectionHead
          title="Получатели"
          action={
            <span className="flex items-center gap-2 text-[11px] font-semibold text-muted">
              {resolving && (
                <>
                  <SearchCheck className="size-3.5 animate-pulse" /> проверяем ники…
                </>
              )}
            </span>
          }
        />
        <div className="mt-4 space-y-2.5">
          <AnimatePresence mode="popLayout">
            {rows.map((r) => (
              <RecipientRow
                key={r.key}
                row={r}
                resolved={r.username.trim() ? resolvedMap[r.username.trim().toLowerCase()] : undefined}
                onChange={(p) => patchRow(r.key, p)}
                onRemove={() => removeRow(r.key)}
                canRemove={rows.length > 1}
              />
            ))}
          </AnimatePresence>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={addRow} icon={<Plus />}>
          Добавить ник
        </Button>

        <div className="mt-5 space-y-3 rounded-2xl bg-card2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-muted">
              {validRows.length} получат. · итого
            </span>
            <RobuxValue value={total} className="text-lg text-accent-strong" />
          </div>
          <AnimatePresence>
            {unresolved && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 overflow-hidden text-[11px] font-semibold text-red"
              >
                <CircleAlert className="size-3.5" /> Один из ников не найден на Roblox —
                проверь правописание
              </motion.p>
            )}
            {overFunds && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 overflow-hidden text-[11px] font-semibold text-red"
              >
                <CircleAlert className="size-3.5" /> Итого больше, чем на счету группы (
                {fmtNum(funds.data!.funds)} R$)
              </motion.p>
            )}
          </AnimatePresence>
          {error && <ErrorBox message={error} />}
          <Button
            className="w-full"
            size="lg"
            onClick={submit}
            loading={busy}
            disabled={!validRows.length || overFunds || unresolved || !groupId}
            icon={<Send />}
          >
            Выплатить
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="flex items-center gap-3 border-green/20 bg-green-soft p-4">
              <CheckCircle2 className="size-5 text-green" />
              <div>
                <p className="text-sm font-bold text-green">Выплата отправлена</p>
                <p className="text-[11px] text-green/80">
                  Робуксы ушли получателям — проверь историю во вкладке «Транзакции → Группа».
                </p>
              </div>
              <button
                onClick={() => setSuccess(false)}
                className="ml-auto grid size-7 place-items-center rounded-full text-green/70 transition-colors hover:bg-green/10 hover:text-green"
                aria-label="Скрыть"
              >
                <X className="size-4" />
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <TwoFAModal
        open={pending !== null}
        pending={pending}
        account={account}
        onClose={() => setPending(null)}
        onSuccess={() => {
          setPending(null);
          setSuccess(true);
          setRows([{ key: keyRef.current++, username: "", amount: "" }]);
          setResolvedMap({});
          funds.reload();
        }}
      />
    </div>
  );
}
