"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-rounded, system-ui, sans-serif",
          background: "#f5f5f7",
          color: "#17171d",
          margin: 0,
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>RoLauncher: критическая ошибка</h1>
          <pre
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 16,
              background: "#ececf0",
              textAlign: "left",
              fontSize: 11,
              whiteSpace: "pre-wrap",
            }}
          >
            {error.message}
          </pre>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              height: 40,
              padding: "0 20px",
              borderRadius: 16,
              border: 0,
              background: "#5856e0",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Перезапустить
          </button>
        </div>
      </body>
    </html>
  );
}
