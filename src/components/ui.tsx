"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------ Card ------------------------------ */

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-line bg-card shadow-card",
        className
      )}
      {...props}
    />
  );
}

/* ----------------------------- Button ----------------------------- */

type BtnVariant = "primary" | "soft" | "outline" | "ghost" | "dangerSoft";
type BtnSize = "sm" | "md" | "lg" | "icon";

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "bg-accent text-white shadow-[0_8px_24px_-8px_var(--accent)] hover:bg-accent-strong",
  soft: "bg-accent-soft text-accent-strong hover:bg-accent-press",
  outline:
    "border border-line bg-card text-soft hover:text-fg hover:border-line-strong",
  ghost: "text-muted hover:bg-card2 hover:text-fg",
  dangerSoft: "bg-red-soft text-red hover:brightness-95 dark:hover:brightness-110",
};

const btnSizes: Record<BtnSize, string> = {
  sm: "h-8 rounded-xl px-3 text-xs gap-1.5",
  md: "h-10 rounded-2xl px-4 text-sm gap-2",
  lg: "h-12 rounded-2xl px-5 text-sm gap-2",
  icon: "h-10 w-10 rounded-2xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, icon, className, children, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150",
        "not-disabled:hover:-translate-y-px not-disabled:active:translate-y-0 not-disabled:active:scale-[.97]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        icon && <span className="inline-flex [&>svg]:size-4">{icon}</span>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ------------------------------ Input ----------------------------- */

const inputBase =
  "w-full rounded-2xl border border-line bg-card px-4 text-sm text-fg placeholder:text-muted/70 transition-all duration-150 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent-soft";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, "h-11", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputBase, "min-h-24 resize-y py-3", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ------------------------------ Select ---------------------------- */

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-11 w-full cursor-pointer appearance-none rounded-2xl border border-line bg-card pl-4 pr-10 text-sm font-medium text-fg transition-all duration-150 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent-soft"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ------------------------------- Modal ---------------------------- */

export function Modal({
  open,
  onClose,
  children,
  className,
  labeledBy,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  labeledBy?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labeledBy}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn(
              "relative z-10 w-full max-w-lg rounded-3xl border border-line bg-card shadow-pop",
              className
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">{children ?? (
        <>
          <h2 className="truncate text-base font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </>
      )}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-card2 hover:text-fg"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Badge ----------------------------- */

const badgeTones = {
  accent: "bg-accent-soft text-accent-strong",
  green: "bg-green-soft text-green",
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  blue: "bg-blue-soft text-blue",
  neutral: "bg-card2 text-soft",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------- Segmented -------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  name,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode }[];
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-2xl border border-line bg-card2 p-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative h-8 rounded-xl px-4 text-sm font-semibold text-muted transition-colors duration-150",
              !active && "hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${name}`}
                className="absolute inset-0 rounded-xl border border-line bg-card shadow-card"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className={cn("relative z-10", active && "text-fg")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Robux ----------------------------- */

/**
 * Иконка робуксов — официальная форма: шестиугольник со скошенными углами
 * и шестиугольным вырезом по центру (как в шапке roblox.com).
 */
export function Robux({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.02 2.3a1.96 1.96 0 0 1 1.96 0l7.07 4.08c.61.35.98.99.98 1.69v8.16c0 .7-.37 1.34-.98 1.69l-7.07 4.08a1.96 1.96 0 0 1-1.96 0L3.95 17.92a1.96 1.96 0 0 1-.98-1.69V8.07c0-.7.37-1.34.98-1.69L11.02 2.3Zm.73 6.05a.5.5 0 0 1 .5 0l2.83 1.63a.5.5 0 0 1 .25.44v3.26a.5.5 0 0 1-.25.44l-2.83 1.63a.5.5 0 0 1-.5 0l-2.83-1.63a.5.5 0 0 1-.25-.44v-3.26a.5.5 0 0 1 .25-.44l2.83-1.63Z"
      />
    </svg>
  );
}

/** Логотип RoLauncher — ромб в градиентном скруглённом квадрате. */
export function Logo({
  size = 36,
  className,
  shimmer = true,
}: {
  size?: number;
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-blue shadow-[0_6px_18px_-6px_var(--accent)]",
        className
      )}
    >
      {shimmer && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0"
          animate={{ x: ["-60%", "160%"] }}
          transition={{
            duration: 3.4,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 2.6,
          }}
        />
      )}
      <div
        style={{ width: size * 0.39, height: size * 0.39 }}
        className="rotate-45 rounded-[4px] border-[2.5px] border-white/90"
      />
    </div>
  );
}

export function RobuxValue({
  value,
  className,
  tone,
}: {
  value: number | null | undefined;
  className?: string;
  tone?: "green" | "red" | "inherit";
}) {
  const color =
    tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-inherit";
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", color, className)}>
      <Robux className="size-[1em] opacity-90" />
      {value === null || value === undefined
        ? "—"
        : new Intl.NumberFormat("ru-RU").format(value)}
    </span>
  );
}

/* ------------------------------ Avatar ---------------------------- */

export function Avatar({
  src,
  name,
  size = 40,
  className,
  rounded = "rounded-full",
  fluid = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  rounded?: string;
  fluid?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const style = fluid ? undefined : { width: size, height: size };
  if (!src || failed) {
    return (
      <div
        style={style}
        className={cn(
          "grid shrink-0 select-none place-items-center bg-gradient-to-br from-accent/25 to-accent/5 font-bold text-accent-strong",
          rounded,
          fluid && "h-full w-full",
          className
        )}
      >
        <span style={{ fontSize: fluid ? "1.4em" : size * 0.4 }}>{initial}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      style={style}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 bg-card2 object-cover",
        rounded,
        fluid && "h-full w-full",
        className
      )}
    />
  );
}

/* --------------------------- Empty state -------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong bg-card/50 px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-strong [&>svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-bold">{title}</p>
      {hint && <div className="max-w-sm text-xs leading-relaxed text-muted">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ----------------------------- Error box -------------------------- */

export function ErrorBox({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-red/15 bg-red-soft px-4 py-3",
        className
      )}
    >
      <AlertTriangle className="size-4 shrink-0 text-red" />
      <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-red">
        {message}
      </p>
      {onRetry && (
        <Button size="sm" variant="dangerSoft" onClick={onRetry} className="shrink-0">
          Ещё раз
        </Button>
      )}
    </div>
  );
}

/* ------------------------------ Spinner ---------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("size-6 animate-spin text-muted", className)} />
  );
}

/* ---------------------------- Skeletons --------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} />;
}

/* --------------------------- Section head ------------------------- */

export function SectionHead({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-soft">
        {title}
      </h2>
      {action}
    </div>
  );
}
