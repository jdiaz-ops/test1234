import { PrismaClient } from "@prisma/client";

// Patrón estándar de singleton para evitar abrir múltiples conexiones a la
// base de datos durante el hot-reload de desarrollo de Next.js.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
