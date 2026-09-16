"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Меняется при смене вкладки/аккаунта — сбрасывает состояние ошибки */
  resetKey?: string;
  label?: string;
}
interface State {
  error: Error | null;
}

/**
 * Локальная граница ошибок: падение одной вкладки больше не убивает
 * всё приложение — показываем понятный экран с текстом ошибки.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RoLauncher] сбой вкладки:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-[2rem] border border-line bg-card p-7 text-center shadow-card">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-red-soft text-red">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">
            Вкладка «{this.props.label ?? "раздел"}» упала
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Само приложение живо — можно переключиться на другую вкладку. Текст
            ошибки ниже, покажи его мне, если повторится.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-card2 px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-soft">
            {error.message || String(error)}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            <RefreshCw className="size-4" /> Попробовать снова
          </button>
        </div>
      </div>
    );
  }
}
