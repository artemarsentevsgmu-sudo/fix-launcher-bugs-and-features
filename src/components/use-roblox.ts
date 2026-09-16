"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RobloxResult<T> {
  data: T | null;
  error: string | null;
  status: number | null;
  loading: boolean;
  /** true, пока показываем данные из кэша и молча обновляем их в фоне */
  revalidating: boolean;
  reload: () => void;
  setData: (updater: (prev: T | null) => T | null) => void;
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Нет связи с сервером лаунчера — проверь соединение");
  }

  // Прокси/таймаут может вернуть HTML вместо JSON — раньше это ломалось
  // сообщением «Unexpected token '<'». Теперь разбираем аккуратно.
  const raw = await res.text().catch(() => "");
  const looksHtml = /^\s*</.test(raw);
  let data: Record<string, unknown> = {};
  if (!looksHtml && raw) {
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!res.ok || looksHtml) {
    if (res.status === 401) {
      try {
        window.dispatchEvent(new CustomEvent("hz:session-expired"));
      } catch {}
    }
    const message = looksHtml
      ? res.status === 504 || res.status === 502
        ? "Сервер долго отвечал (Roblox тормозит) — попробуй ещё раз"
        : `Сервер вернул страницу вместо данных (${res.status}) — попробуй ещё раз`
      : (data.error as string) || `Ошибка ${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

/* --------------------------------------------------------------------- *
 * Кэш на время жизни вкладки браузера. Благодаря нему переход между
 * разделами лаунчера не перезагружает данные заново — показываем последний
 * результат мгновенно и тихо обновляем его в фоне.
 * --------------------------------------------------------------------- */

interface CacheEntry {
  data: unknown;
  at: number;
}

const memory = new Map<string, CacheEntry>();
/** Сколько считаем данные «свежими» и не трогаем сеть совсем. */
const FRESH_MS = 60_000;

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export function useRoblox<T>(
  buildUrl: () => string | null,
  deps: unknown[] = [],
  options: { cache?: boolean } = {}
): RobloxResult<T> {
  const useCache = options.cache !== false;
  const url = buildUrl();
  const cached = url && useCache ? (memory.get(url) as CacheEntry | undefined) : undefined;

  const [data, setDataState] = useState<T | null>((cached?.data as T) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [tick, setTick] = useState(0);
  const urlRef = useRef(url);
  urlRef.current = url;

  const run = useCallback(
    async (force: boolean) => {
      const target = urlRef.current;
      if (!target) {
        setLoading(false);
        return;
      }
      const hit = useCache ? memory.get(target) : undefined;
      const fresh = hit && Date.now() - hit.at < FRESH_MS;

      if (hit) {
        // мгновенно показываем то, что уже знаем
        setDataState(hit.data as T);
        setLoading(false);
        setError(null);
        if (fresh && !force) return;
        setRevalidating(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const d = await apiFetch<T>(target);
        if (urlRef.current !== target) return; // пользователь уже ушёл дальше
        if (useCache) memory.set(target, { data: d, at: Date.now() });
        setDataState(d);
        setStatus(null);
        setError(null);
      } catch (e) {
        if (urlRef.current !== target) return;
        const msg = e instanceof Error ? e.message : "Ошибка загрузки";
        setStatus((e as { status?: number }).status ?? null);
        // если есть что показать из кэша — оставляем данные и не пугаем экраном ошибки
        if (memory.has(target) && !force) {
          setError(null);
        } else {
          setError(msg);
          setDataState(null);
        }
      } finally {
        if (urlRef.current === target) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useCache, ...deps]
  );

  useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, tick]);

  useEffect(() => {
    const h = () => {
      if (urlRef.current) memory.delete(urlRef.current);
      setTick((t) => t + 1);
    };
    window.addEventListener("hz:refresh", h);
    return () => window.removeEventListener("hz:refresh", h);
  }, []);

  const reload = useCallback(() => {
    if (urlRef.current) memory.delete(urlRef.current);
    setTick((t) => t + 1);
  }, []);

  const setData = useCallback(
    (updater: (prev: T | null) => T | null) => {
      setDataState((prev) => {
        const next = updater(prev);
        const target = urlRef.current;
        if (target && useCache && next !== null) {
          memory.set(target, { data: next, at: Date.now() });
        }
        return next;
      });
    },
    [useCache]
  );

  return { data, error, status, loading, revalidating, reload, setData };
}

/** Кэш произвольных значений вкладок (списки, курсоры, выбранные фильтры). */
const scratch = new Map<string, unknown>();

export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    scratch.has(key) ? (scratch.get(key) as T) : initial
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        scratch.set(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, set] as const;
}
