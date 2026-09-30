import { execSync } from "node:child_process";

/// Corre `prisma migrate deploy` en el build de Vercel. Prisma Migrate no
/// se lleva bien con el pooler de conexiones de Prisma Postgres
/// (pooled.db.prisma.io): toma un "advisory lock" en una conexión del
/// pooler que después puede quedar atascada, y todo deploy siguiente
/// muere con P1002 ("The database server was reached but timed out")
/// exactamente 10 s después de "N migrations found". Pasó el 2026-09-30
/// en marcolini1/test1234. Por eso acá las migraciones van por la
/// conexión directa (mismas credenciales, host db.prisma.io — o DIRECT_URL
/// si está definida) y sin el advisory lock; la app en runtime sigue
/// usando DATABASE_URL tal cual (pooled).
const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl =
  process.env.DIRECT_URL || databaseUrl.replace("@pooled.db.prisma.io", "@db.prisma.io");

try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: directUrl,
      PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
    },
  });
} catch (err) {
  // Prisma ya imprimió el error real arriba — solo hace falta que el
  // build falle con el mismo código, sin el stack trace de Node encima.
  process.exit(typeof err?.status === "number" ? err.status : 1);
}
