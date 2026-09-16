"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AtSign,
  BadgeCheck,
  Crown,
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  PencilLine,
  Phone,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { AccountInfo } from "@/lib/types";
import { apiFetch, useRoblox } from "@/components/use-roblox";
import { cn, fmtCompact, fmtDate, fmtDateTime } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorBox,
  Input,
  Robux,
  SectionHead,
  Skeleton,
  Textarea,
} from "@/components/ui";

interface Settings {
  userId: number;
  username: string;
  displayName: string;
  headshot: string | null;
  description: string;
  created: string | null;
  robux: number | null;
  email: { masked: string; verified: boolean } | null;
  phone: { masked: string; verified: boolean } | null;
  birthdate: { birthDay: number; birthMonth: number; birthYear: number } | null;
  twoStep: { enabled: boolean; mediaType: string } | null;
  premium: boolean;
  chatPrivacy: string | null;
  emailBlocked?: boolean;
  sessionsBlocked?: boolean;
  pastUsernames: string[];
  sessions: {
    token: string;
    ip: string;
    location: string;
    device: string;
    lastSeen: string | null;
    current: boolean;
  }[];
}

function Row({
  icon,
  title,
  value,
  badge,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  value?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card2 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-muted [&>svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-soft">{title}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{value ?? "—"}</p>
      </div>
      {badge}
      {action}
    </div>
  );
}

function FormCard({
  title,
  icon,
  hint,
  fields,
  submitLabel,
  onSubmit,
  danger,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  submitLabel: string;
  danger?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const err = await onSubmit(values);
    setBusy(false);
    if (err) setMsg({ ok: false, text: err });
    else {
      setMsg({ ok: true, text: "Сохранено" });
      setValues({});
    }
  };

  const filled = fields.every((f) => (values[f.key] ?? "").trim().length > 0);

  return (
    <Card className="p-5">
      <SectionHead title={<><span className="[&>svg]:size-4">{icon}</span>{title}</>} />
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{hint}</p>}
      <div className="mt-3 space-y-2.5">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-[11px] font-bold text-muted">{f.label}</label>
            <Input
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              autoComplete="off"
            />
          </div>
        ))}
        {msg && (
          <p className={cn("text-[11px] font-semibold", msg.ok ? "text-green" : "text-red")}>
            {msg.text}
          </p>
        )}
        <Button
          onClick={submit}
          loading={busy}
          disabled={!filled}
          variant={danger ? "dangerSoft" : "primary"}
        >
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsTab({ account }: { account: AccountInfo }) {
  const s = useRoblox<Settings>(
    () => `/api/roblox/settings?account=${account.id}`,
    [account.id]
  );
  const [desc, setDesc] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const [display, setDisplay] = useState("");
  const [displayBusy, setDisplayBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (s.data) {
      setDesc(s.data.description);
      setDisplay(s.data.displayName);
    }
  }, [s.data]);

  const post = async (payload: Record<string, unknown>): Promise<string | null> => {
    try {
      await apiFetch("/api/roblox/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.id, ...payload }),
      });
      s.reload();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Ошибка";
    }
  };

  const d = s.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Fingerprint className="size-5 text-accent-strong" /> Настройки аккаунта
        </h1>
        <p className="mt-1 text-xs text-muted">
          Всё как на roblox.com/my/account — профиль, безопасность, сессии и подписка.
        </p>
      </div>

      {err && <ErrorBox message={err} />}
      {note && (
        <div className="rounded-2xl bg-green-soft px-4 py-3 text-xs font-bold text-green">
          {note}
        </div>
      )}

      {s.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-52" />
          <Skeleton className="h-40" />
        </div>
      ) : s.error ? (
        <ErrorBox message={s.error} onRetry={s.reload} />
      ) : d ? (
        <>
          {/* ------------------------------ шапка ---------------------------- */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="relative overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent-soft blur-2xl" />
              <div className="relative flex flex-wrap items-center gap-5">
                <Avatar src={d.headshot} name={d.displayName} size={88} rounded="rounded-[1.5rem]" />
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-tight">
                    {d.displayName}
                    {d.premium && (
                      <Badge tone="amber">
                        <Crown className="size-3" /> Premium
                      </Badge>
                    )}
                  </h2>
                  <p className="text-sm text-muted">@{d.username}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    ID {d.userId} · регистрация {fmtDate(d.created)}
                  </p>
                </div>
                <div className="rounded-2xl bg-card2 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Баланс
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold text-accent-strong">
                    <Robux className="size-4" />
                    {fmtCompact(d.robux)}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ------------------------------ обзор ---------------------------- */}
          <Card className="space-y-2 p-5">
            <SectionHead title="Личные данные" />
            <Row
              icon={<Mail />}
              title="Почта"
              value={
                d.email?.masked ||
                (d.emailBlocked ? "Roblox не отдаёт данные с этого IP" : "не привязана")
              }
              badge={
                d.emailBlocked ? (
                  <Badge tone="amber">скрыто регионом</Badge>
                ) : d.email?.verified ? (
                  <Badge tone="green">
                    <BadgeCheck className="size-3" /> подтверждена
                  </Badge>
                ) : (
                  <Badge tone="amber">не подтверждена</Badge>
                )
              }
              action={
                !d.email?.verified && d.email ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const e = await post({ action: "verify-email-resend" });
                      e ? setErr(e) : setNote("Письмо отправлено");
                    }}
                  >
                    Отправить письмо
                  </Button>
                ) : undefined
              }
            />
            <Row
              icon={<Phone />}
              title="Телефон"
              value={d.phone?.masked || "не привязан"}
              badge={
                d.phone?.verified ? (
                  <Badge tone="green">подтверждён</Badge>
                ) : d.phone ? (
                  <Badge tone="amber">не подтверждён</Badge>
                ) : undefined
              }
            />
            <Row
              icon={d.twoStep?.enabled ? <ShieldCheck /> : <ShieldX />}
              title="Двухфакторная защита"
              value={
                d.twoStep?.enabled
                  ? `включена · ${d.twoStep.mediaType || "приложение"}`
                  : "выключена"
              }
              badge={
                d.twoStep?.enabled ? (
                  <Badge tone="green">защищено</Badge>
                ) : (
                  <Badge tone="red">риск</Badge>
                )
              }
              action={
                <a href="https://www.roblox.com/my/account#!/security" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    Настроить
                  </Button>
                </a>
              }
            />
            <Row
              icon={<Sparkles />}
              title="Подписка Premium"
              value={d.premium ? "активна" : "нет подписки"}
              action={
                <a href="https://www.roblox.com/premium/membership" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    Управлять
                  </Button>
                </a>
              }
            />
            {d.birthdate && (
              <Row
                icon={<UserRound />}
                title="Дата рождения"
                value={`${d.birthdate.birthDay}.${d.birthdate.birthMonth}.${d.birthdate.birthYear}`}
              />
            )}
            {d.pastUsernames.length > 0 && (
              <Row
                icon={<AtSign />}
                title="Прошлые ники"
                value={d.pastUsernames.slice(0, 6).join(", ")}
              />
            )}
          </Card>

          {/* ---------------------------- профиль ---------------------------- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHead
                title={<><PencilLine className="size-4" />Отображаемое имя</>}
                action={
                  display !== d.displayName && (
                    <Button
                      size="sm"
                      loading={displayBusy}
                      onClick={async () => {
                        setDisplayBusy(true);
                        const e = await post({ action: "display-name", value: display });
                        setDisplayBusy(false);
                        e ? setErr(e) : setNote("Имя обновлено");
                      }}
                    >
                      Сохранить
                    </Button>
                  )
                }
              />
              <Input
                className="mt-3"
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
                maxLength={20}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Меняется бесплатно, но не чаще 7 дней. Ник (@{d.username}) — отдельно ниже.
              </p>
            </Card>

            <Card className="p-5">
              <SectionHead
                title={<><UserRound className="size-4" />О себе</>}
                action={
                  desc !== d.description && (
                    <Button
                      size="sm"
                      loading={descBusy}
                      onClick={async () => {
                        setDescBusy(true);
                        const e = await post({ action: "description", value: desc });
                        setDescBusy(false);
                        e ? setErr(e) : setNote("Описание обновлено");
                      }}
                    >
                      Сохранить
                    </Button>
                  )
                }
              />
              <Textarea
                className="mt-3"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={1000}
              />
            </Card>
          </div>

          {/* --------------------------- безопасность ------------------------ */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FormCard
              title="Сменить ник"
              icon={<AtSign />}
              hint="Roblox спишет 1 000 R$. Нужен текущий пароль."
              fields={[
                { key: "username", label: "Новый ник", placeholder: "NewUsername" },
                { key: "password", label: "Текущий пароль", type: "password" },
              ]}
              submitLabel="Сменить ник"
              onSubmit={(v) =>
                post({ action: "username", username: v.username, password: v.password })
              }
            />
            <FormCard
              title="Сменить пароль"
              icon={<KeyRound />}
              hint="После смены Roblox завершит другие сессии — куки может обновиться."
              fields={[
                { key: "currentPassword", label: "Текущий пароль", type: "password" },
                { key: "newPassword", label: "Новый пароль", type: "password" },
              ]}
              submitLabel="Сменить пароль"
              onSubmit={(v) =>
                post({
                  action: "password",
                  currentPassword: v.currentPassword,
                  newPassword: v.newPassword,
                })
              }
            />
            <FormCard
              title="Сменить почту"
              icon={<Mail />}
              hint="На новый адрес придёт письмо для подтверждения."
              fields={[
                { key: "email", label: "Новая почта", type: "email" },
                { key: "password", label: "Текущий пароль", type: "password" },
              ]}
              submitLabel="Сменить почту"
              onSubmit={(v) => post({ action: "email", email: v.email, password: v.password })}
            />
          </div>

          {/* ------------------------------ сессии --------------------------- */}
          <Card className="p-5">
            <SectionHead
              title={<><Laptop className="size-4" />Активные входы · {d.sessions.length}</>}
              action={
                <Button
                  size="sm"
                  variant="dangerSoft"
                  icon={<LogOut />}
                  onClick={async () => {
                    const e = await post({ action: "logout-others" });
                    e ? setErr(e) : setNote("Другие сессии завершены");
                  }}
                >
                  Выйти на других устройствах
                </Button>
              }
            />
            <div className="mt-3 space-y-2">
              {d.sessions.length === 0 ? (
                <p className="rounded-2xl bg-card2 px-4 py-3 text-xs text-muted">
                  {d.sessionsBlocked
                    ? "Roblox блокирует список сессий при запросе с серверного IP — открой roblox.com/my/account#!/security, чтобы увидеть устройства."
                    : "Активных сессий не найдено."}
                </p>
              ) : (
                d.sessions.map((sess) => (
                  <div
                    key={sess.token}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-card2 px-4 py-3"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-muted">
                      <Laptop className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {sess.device || "Устройство"} · {sess.location || "неизвестно"}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {sess.ip} · {fmtDateTime(sess.lastSeen)}
                      </p>
                    </div>
                    {sess.current ? (
                      <Badge tone="green">это устройство</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const e = await post({ action: "revoke-session", token: sess.token });
                          e ? setErr(e) : setNote("Сессия завершена");
                        }}
                      >
                        Завершить
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <p className="text-[11px] leading-relaxed text-muted/80">
            Смена ника, пароля и почты идёт через официальные эндпоинты Roblox и требует
            пароль. Roblox может запросить 2FA — в этом случае операцию нужно подтвердить
            на сайте. Включение самой двухфакторки делается только на roblox.com.
          </p>
        </>
      ) : null}
    </div>
  );
}
