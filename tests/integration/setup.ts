/// Las pruebas de base de datos usan SOLO la base de prueba de
/// TEST_DATABASE_URL (en CI, un Postgres desechable; en local, uno propio).
/// Se copia a DATABASE_URL antes de que cualquier archivo importe Prisma.
/// Si alguien apunta TEST_DATABASE_URL a la base real por error, se niega.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (/prisma\.io|vercel|neon\.tech|supabase/i.test(url)) {
    throw new Error("TEST_DATABASE_URL parece la base de datos real. Las pruebas solo corren contra una base de prueba.");
  }
  process.env.DATABASE_URL = url;
}
// Correos simulados (sin llave de Resend) durante las pruebas.
delete process.env.RESEND_API_KEY;
