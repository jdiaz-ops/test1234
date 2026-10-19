-- Buzón de sugerencias del portal de marcas y de creadoras (2026-10-19).

-- CreateEnum
CREATE TYPE "SuggestionPortal" AS ENUM ('BRAND', 'CREATOR');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('IDEA', 'IMPROVEMENT', 'PROBLEM', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'READ', 'DONE');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portal" "SuggestionPortal" NOT NULL,
    "kind" "SuggestionKind",
    "message" TEXT,
    "audioUrl" TEXT,
    "audioSeconds" INTEGER,
    "pagePath" TEXT,
    "userAgent" TEXT,
    "sentByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_userId_createdAt_idx" ON "Suggestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aviso al admin cuando llega una (Admin → Notificaciones → Configuración).
INSERT INTO "NotificationTypeConfig" ("id", "key", "label", "audience", "channelEmail", "messageTemplate", "placeholders", "updatedAt") VALUES
('suggestionadmin', 'SUGGESTION_ADMIN', 'Sugerencia en el buzón', 'ADMIN', true, '{remitente} ({portal}) mandó una sugerencia: {resumen} Léela en Admin → Sugerencias.', 'remitente,portal,resumen', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
