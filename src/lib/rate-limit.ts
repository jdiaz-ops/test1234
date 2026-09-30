import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/// Límite de intentos por ventana fija, guardado en la base de datos (tabla
/// RateLimit): en Vercel cada petición puede caer en una instancia distinta,
/// así que un contador en memoria no serviría. Un solo INSERT ... ON
/// CONFLICT atómico por intento — dos peticiones simultáneas no se pisan.
///
/// Si la base de datos falla, deja pasar (mejor no bloquear una compra real
/// por un problema del contador). Ver conversación del 2026-09-30: nada
/// impedía probar miles de códigos de creador seguidos.

/// IP del cliente según los encabezados de Vercel.
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "desconocida";
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  try {
    // LOCALTIMESTAMP en todo (sin zona horaria) para que las comparaciones
    // sean consistentes con la columna TIMESTAMP(3).
    const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, LOCALTIMESTAMP, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < LOCALTIMESTAMP - make_interval(secs => ${windowSeconds}::double precision)
          THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < LOCALTIMESTAMP - make_interval(secs => ${windowSeconds}::double precision)
          THEN LOCALTIMESTAMP ELSE "RateLimit"."windowStart" END
      RETURNING "count",
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}::double precision) - LOCALTIMESTAMP))))::int AS "retry"`;
    const row = rows[0];

    // Limpieza ocasional de llaves viejas (1 de cada 100 intentos).
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < LOCALTIMESTAMP - interval '1 day'`;
    }

    if (!row) return { ok: true, retryAfterSeconds: 0 };
    return { ok: Number(row.count) <= limit, retryAfterSeconds: Number(row.retry) };
  } catch (err) {
    console.error(`[rate-limit] falló el contador para "${key}", se deja pasar:`, err);
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/// Atajo para rutas: null si puede seguir, o la respuesta 429 lista.
export async function limitOrReject(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const result = await rateLimit(`${name}:${clientIp(req)}`, limit, windowSeconds);
  if (result.ok) return null;
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
  return NextResponse.json(
    { error: `Demasiados intentos. Espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} y vuelve a intentarlo.` },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
