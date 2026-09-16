"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Check,
  HandCoins,
  Home,
  LineChart,
  LogIn,
  Moon,
  PersonStanding,
  Plus,
  RefreshCw,
  ShieldCheck,
  Settings2,
  ShoppingBag,
  Sun,
  Tags,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountInfo } from "@/lib/types";
import {
  Avatar,
  Button,
  ErrorBox,
  Input,
  Logo,
  Modal,
  ModalHeader,
  Spinner,
} from "@/components/ui";
import ErrorBoundary from "@/components/error-boundary";
import { apiFetch } from "@/components/use-roblox";
import HomeTab from "@/components/tabs/home";
import AvatarTab from "@/components/tabs/avatar";
import GroupsTab from "@/components/tabs/groups";
import StoreTab from "@/components/tabs/store";
import PricesTab from "@/components/tabs/prices";
import AnalyticsTab from "@/components/tabs/analytics";
import PayoutsTab from "@/components/tabs/payouts";
import TransactionsTab from "@/components/tabs/transactions";
import SettingsTab from "@/components/tabs/settings";

export type TabId =
  | "home"
  | "avatar"
  | "groups"
  | "store"
  | "prices"
  | "analytics"
  | "payouts"
  | "transactions"
  | "settings";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "avatar", label: "Аватар", icon: PersonStanding },
  { id: "groups", label: "Группы", icon: Users },
  { id: "store", label: "Магазин", icon: ShoppingBag },
  { id: "prices", label: "Цены", icon: Tags },
  { id: "analytics", label: "Аналитика", icon: LineChart },
  { id: "payouts", label: "Выплаты", icon: HandCoins },
  { id: "transactions", label: "Транзакции", icon: ArrowLeftRight },
  { id: "settings", label: "Настройки", icon: Settings2 },
];

/* --------------------------- Theme toggle -------------------------- */

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hz-theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      aria-label="Переключить тему"
      className="grid size-9 place-items-center rounded-2xl text-muted transition-colors hover:bg-card2 hover:text-fg"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="grid place-items-center"
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ------------------------- Add account modal ----------------------- */

function AddAccountModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (a: AccountInfo) => void;
}) {
  const [cookie, setCookie] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (open) {
      setCookie("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch<{ account: AccountInfo; updated: boolean }>(
        "/api/roblox/accounts",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cookie }),
          signal: AbortSignal.timeout(25_000),
        }
      );
      onAdded(data.account);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labeledBy="add-acc">
      <ModalHeader
        title="Добавить аккаунт Roblox"
        subtitle="Нужен только куки .ROBLOSECURITY — пароль не требуется"
        onClose={onClose}
      />
      <div className="space-y-4 px-6 py-5">
        <Input
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          placeholder="_|WARNING:-DO-NOT-SHARE..."
          className="h-12 font-mono text-xs"
          autoFocus
          spellCheck={false}
        />
        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-2 rounded-2xl bg-card2 px-4 py-3 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="size-4 shrink-0 text-green" />
          Куки хранится только в базе этого лаунчера и используется для запросов к
          официальному API Roblox с сервера, а не из браузера.
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs font-semibold text-accent-strong transition-colors hover:underline"
        >
          {showHelp ? "Скрыть инструкцию" : "Как получить куки .ROBLOSECURITY?"}
        </button>
        <AnimatePresence>
          {showHelp && (
            <motion.ol
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="list-decimal space-y-1 overflow-hidden pl-5 text-xs leading-relaxed text-soft"
            >
              <li>Зайди на roblox.com и войди в нужный аккаунт.</li>
              <li>Открой DevTools (F12) → вкладка «Приложение / Application».</li>
              <li>Раздел Cookies → https://www.roblox.com.</li>
              <li>Скопируй значение .ROBLOSECURITY и вставь сюда.</li>
              <li>После вставки не выходи из аккаунта на сайте, иначе куки сбросится.</li>
            </motion.ol>
          )}
        </AnimatePresence>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button loading={busy} onClick={submit} disabled={!cookie.trim()}>
          Подключить
        </Button>
      </div>
    </Modal>
  );
}

/* --------------------------- Shell -------------------------------- */

export default function AppShell() {
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("home");
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [avatars, setAvatars] = useState<Record<number, string>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = accounts?.find((a) => a.id === activeId) ?? null;

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiFetch<{ accounts: AccountInfo[] }>(
        "/api/roblox/accounts",
        { signal: AbortSignal.timeout(12_000) }
      );
      const list: AccountInfo[] = data.accounts ?? [];
      setAccounts(list);
      let stored: number | null = null;
      try {
        stored = Number(localStorage.getItem("hz-account")) || null;
      } catch {}
      if (list.length === 0) {
        setActiveId(null);
      } else if (stored && list.some((a) => a.id === stored)) {
        setActiveId(stored);
      } else {
        setActiveId(list[0].id);
      }
      return list;
    } catch {
      setAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadAccounts();
      if (list.length === 0) setAddOpen(true);
    })();
  }, [loadAccounts]);

  useEffect(() => {
    try {
      const t = localStorage.getItem("hz-tab");
      if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
    } catch {}
  }, []);

  // подтягиваем аватарки аккаунтов для шапки и меню
  useEffect(() => {
    if (!accounts?.length) return;
    let alive = true;
    (async () => {
      const pairs = await Promise.all(
        accounts.map(async (a) => {
          try {
            const res = await fetch(`/api/roblox/me?account=${a.id}`);
            if (!res.ok) return null;
            const d = await res.json();
            return d?.headshot ? ([a.id, d.headshot] as const) : null;
          } catch {
            return null;
          }
        })
      );
      if (!alive) return;
      const map: Record<number, string> = {};
      for (const p of pairs) if (p) map[p[0]] = p[1];
      setAvatars((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      alive = false;
    };
  }, [accounts]);

  useEffect(() => {
    const onExpired = () => setAddOpen(true);
    window.addEventListener("hz:session-expired", onExpired);
    return () => window.removeEventListener("hz:session-expired", onExpired);
  }, []);

  // навигация между вкладками из глубины компонентов («Показать в аналитике» и т.п.)
  useEffect(() => {
    const onGoto = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as TabId | undefined;
      if (tab && TABS.some((t) => t.id === tab)) selectTab(tab);
    };
    window.addEventListener("hz:goto", onGoto);
    return () => window.removeEventListener("hz:goto", onGoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const selectAccount = (id: number) => {
    setActiveId(id);
    setMenuOpen(false);
    setConfirmDelete(false);
    try {
      localStorage.setItem("hz-account", String(id));
    } catch {}
  };

  const selectTab = (t: TabId) => {
    setTab(t);
    try {
      localStorage.setItem("hz-tab", t);
    } catch {}
  };

  const removeAccount = async () => {
    if (!active) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimer.current && clearTimeout(deleteTimer.current);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 3500);
      return;
    }
    await fetch(`/api/roblox/accounts?id=${active.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    setMenuOpen(false);
    try {
      localStorage.removeItem("hz-account");
    } catch {}
    await loadAccounts();
  };

  const refreshAll = async () => {
    setSyncing(true);
    setMenuOpen(false);
    await loadAccounts();
    window.dispatchEvent(new CustomEvent("hz:refresh"));
    setTimeout(() => setSyncing(false), 700);
  };

  return (
    <div className="min-h-screen">
      {/* ------------------------- Top nav ------------------------- */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <motion.nav
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="mx-auto flex max-w-6xl items-center gap-1 rounded-3xl border border-line bg-card/80 px-2 py-2 shadow-card backdrop-blur-xl"
        >
          <div className="mr-1 flex items-center gap-2.5 pl-1.5 pr-2">
            <Logo size={36} />
            <div className="hidden leading-tight lg:block">
              <p className="text-sm font-extrabold tracking-tight">RoLauncher</p>
              <p className="text-[10px] font-medium text-muted">Roblox лаунчер</p>
            </div>
          </div>

          <div className="no-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto">
            {TABS.map((t) => {
              const activeTab = t.id === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "relative flex h-9 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-semibold transition-colors duration-150 sm:px-3.5",
                    activeTab ? "text-accent-strong" : "text-muted hover:text-fg"
                  )}
                >
                  {activeTab && (
                    <motion.span
                      layoutId="topnav-pill"
                      className="absolute inset-0 rounded-2xl bg-accent-soft"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  )}
                  <Icon className="relative z-10 size-4" />
                  <span className="relative z-10 hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          <ThemeToggle />
          <div className="mx-0.5 h-5 w-px bg-line" />

          {/* ------------------- Account menu ------------------- */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={!active}
              className={cn(
                "flex h-9 items-center gap-2 rounded-2xl pl-1.5 pr-2.5 text-[13px] font-semibold transition-colors",
                active
                  ? "text-soft hover:bg-card2 hover:text-fg"
                  : "text-muted"
              )}
            >
              {accounts === null ? (
                <Spinner className="size-4" />
              ) : active ? (
                <>
                  <Avatar
                    src={avatars[active.id]}
                    name={active.displayName}
                    size={26}
                  />
                  <span className="hidden max-w-28 truncate md:inline">
                    {active.displayName}
                  </span>
                </>
              ) : (
                <>
                  <UserRound className="size-4" />
                  <span className="hidden md:inline">Нет аккаунта</span>
                </>
              )}
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-11 w-72 overflow-hidden rounded-3xl border border-line bg-card p-1.5 shadow-pop"
                >
                  {accounts?.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => selectAccount(a.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-card2"
                    >
                      <Avatar src={avatars[a.id]} name={a.displayName} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold leading-tight">
                          {a.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          @{a.username}
                        </span>
                      </span>
                      {a.id === activeId && <Check className="size-4 text-accent-strong" />}
                    </button>
                  ))}
                  <div className="my-1.5 h-px bg-line" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setAddOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-soft transition-colors hover:bg-card2 hover:text-fg"
                  >
                    <span className="grid size-[34px] place-items-center rounded-full bg-accent-soft text-accent-strong">
                      <Plus className="size-4" />
                    </span>
                    Добавить аккаунт
                  </button>
                  <button
                    onClick={refreshAll}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-soft transition-colors hover:bg-card2 hover:text-fg"
                  >
                    <span className="grid size-[34px] place-items-center rounded-full bg-card2 text-muted">
                      <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
                    </span>
                    Обновить данные
                  </button>
                  {active && (
                    <button
                      onClick={removeAccount}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                        confirmDelete
                          ? "bg-red-soft text-red"
                          : "text-soft hover:bg-card2 hover:text-fg"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-[34px] place-items-center rounded-full",
                          confirmDelete ? "bg-red/15 text-red" : "bg-card2 text-muted"
                        )}
                      >
                        <Trash2 className="size-4" />
                      </span>
                      {confirmDelete ? "Точно удалить? Нажми ещё раз" : "Удалить аккаунт"}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.nav>
      </header>

      {/* --------------------------- Content ------------------------ */}
      <main className="mx-auto max-w-6xl px-3 pb-20 pt-5 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${active?.id ?? "none"}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.25, 0.8, 0.35, 1] }}
          >
            {accounts === null ? (
              <div className="grid place-items-center py-32">
                <Spinner />
              </div>
            ) : !active ? (
              <div className="mx-auto max-w-xl py-16">
                <div className="rounded-[2rem] border border-line bg-card p-8 text-center shadow-card">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                    className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-accent to-blue text-white shadow-[0_16px_40px_-12px_var(--accent)]"
                  >
                    <LogIn className="size-7" />
                  </motion.div>
                  <h1 className="text-xl font-extrabold tracking-tight">
                    RoLauncher · подключи аккаунт
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    Добавь куки .ROBLOSECURITY, чтобы управлять группами, следить за
                    друзьями, продажами и выплатами — всё в одном месте.
                  </p>
                  <Button className="mt-6" size="lg" onClick={() => setAddOpen(true)}>
                    <Plus className="size-4" /> Добавить аккаунт
                  </Button>
                </div>
              </div>
            ) : (
              <ErrorBoundary
                resetKey={`${tab}-${active.id}`}
                label={TABS.find((t) => t.id === tab)?.label}
              >
                {tab === "home" ? (
                  <HomeTab account={active} />
                ) : tab === "avatar" ? (
                  <AvatarTab account={active} />
                ) : tab === "groups" ? (
                  <GroupsTab account={active} />
                ) : tab === "store" ? (
                  <StoreTab account={active} />
                ) : tab === "prices" ? (
                  <PricesTab account={active} />
                ) : tab === "analytics" ? (
                  <AnalyticsTab account={active} />
                ) : tab === "payouts" ? (
                  <PayoutsTab account={active} />
                ) : tab === "settings" ? (
                  <SettingsTab account={active} />
                ) : (
                  <TransactionsTab account={active} />
                )}
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AddAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(a) => {
          // Сразу добавляем в список и выбираем — иначе UI не заметит новый аккаунт
          setAccounts((prev) => {
            const others = (prev ?? []).filter((x) => x.id !== a.id);
            return [a, ...others];
          });
          selectAccount(a.id);
        }}
      />
    </div>
  );
}
