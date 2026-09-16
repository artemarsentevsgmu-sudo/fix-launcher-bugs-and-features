import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Healthcheck не должен висеть: если Postgres на старте ещё не прогрелся,
 * раньше запрос ждал вечно и превью застревало в «restoring».
 * Теперь ждём максимум 3 секунды и всё равно отвечаем.
 */
export async function GET() {
  const probe = db
    .execute(sql`select 1`)
    .then(() => "up" as const)
    .catch(() => "down" as const);

  const timeout = new Promise<"slow">((resolve) =>
    setTimeout(() => resolve("slow"), 3000)
  );

  const database = await Promise.race([probe, timeout]);

  // Сервер жив — отвечаем 200, состояние БД отдаём отдельным полем.
  return Response.json({ ok: true, database }, { status: 200 });
}
