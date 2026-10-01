-- Conexiones: webhooks salientes por tienda
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "BrandProfile" ADD COLUMN "webhookSigningSecret" TEXT;

-- Número correlativo de pedido (los existentes lo reciben en orden de creación)
CREATE SEQUENCE "StoreOrder_number_seq";
ALTER TABLE "StoreOrder" ADD COLUMN "number" INTEGER;
UPDATE "StoreOrder" AS o
SET "number" = ranked.rn
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn FROM "StoreOrder") AS ranked
WHERE o."id" = ranked."id";
SELECT setval('"StoreOrder_number_seq"', COALESCE((SELECT MAX("number") FROM "StoreOrder"), 0) + 1, false);
ALTER TABLE "StoreOrder" ALTER COLUMN "number" SET DEFAULT nextval('"StoreOrder_number_seq"');
ALTER TABLE "StoreOrder" ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "StoreOrder_number_seq" OWNED BY "StoreOrder"."number";
CREATE UNIQUE INDEX "StoreOrder_number_key" ON "StoreOrder"("number");

CREATE TABLE "BrandWebhook" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandWebhook_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrandWebhook_brandId_topic_idx" ON "BrandWebhook"("brandId", "topic");
ALTER TABLE "BrandWebhook" ADD CONSTRAINT "BrandWebhook_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");
CREATE INDEX "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "BrandWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
