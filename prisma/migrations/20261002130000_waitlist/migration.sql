-- Lista de espera de la página pública
CREATE TYPE "WaitlistKind" AS ENUM ('CREATOR', 'BRAND');

CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "kind" "WaitlistKind" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "handle" TEXT,
    "audience" TEXT,
    "category" TEXT,
    "company" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistEntry_kind_email_key" ON "WaitlistEntry"("kind", "email");
CREATE INDEX "WaitlistEntry_kind_createdAt_idx" ON "WaitlistEntry"("kind", "createdAt");
