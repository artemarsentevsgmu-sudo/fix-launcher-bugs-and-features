"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-line bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-red-soft text-2xl">
          ⚠️
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">Что-то сломалось</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          RoLauncher поймал ошибку и не дал приложению умереть. Нажми «Перезапустить».
        </p>
        <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-card2 px-4 py-3 text-left font-mono text-[11px] text-soft">
          {error.message}
        </pre>
        <button
          onClick={reset}
          className="mt-5 h-10 rounded-2xl bg-accent px-5 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          Перезапустить
        </button>
      </div>
    </main>
  );
}
