-- CreateEnum
CREATE TYPE "PrBoxStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PrBoxRequestStatus" AS ENUM ('REQUESTED', 'PROPOSED', 'APPROVED', 'REJECTED', 'DECLINED');

-- CreateTable
CREATE TABLE "PrBox" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contents" TEXT NOT NULL,
    "images" TEXT[],
    "units" INTEGER NOT NULL,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "contentBrief" TEXT NOT NULL,
    "keyMessages" TEXT NOT NULL DEFAULT '',
    "requestUntil" TIMESTAMP(3),
    "shipsOn" TIMESTAMP(3),
    "publishBy" TIMESTAMP(3),
    "status" "PrBoxStatus" NOT NULL DEFAULT 'DRAFT',
    "inMarketplace" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrBoxRequest" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "initiatedBy" "SampleRequestInitiator" NOT NULL,
    "message" TEXT,
    "shippingName" TEXT,
    "shippingDocument" TEXT,
    "shippingEmail" TEXT,
    "shippingPhone" TEXT,
    "shippingRegion" TEXT,
    "shippingCity" TEXT,
    "shippingAddress" TEXT,
    "shippingNotes" TEXT,
    "status" "PrBoxRequestStatus" NOT NULL,
    "rejectedReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "postUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrBoxRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrBox_brandId_createdAt_idx" ON "PrBox"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "PrBox_status_idx" ON "PrBox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PrBoxRequest_orderId_key" ON "PrBoxRequest"("orderId");

-- CreateIndex
CREATE INDEX "PrBoxRequest_creatorId_status_idx" ON "PrBoxRequest"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrBoxRequest_boxId_creatorId_key" ON "PrBoxRequest"("boxId", "creatorId");

-- AddForeignKey
ALTER TABLE "PrBox" ADD CONSTRAINT "PrBox_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrBoxRequest" ADD CONSTRAINT "PrBoxRequest_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "PrBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrBoxRequest" ADD CONSTRAINT "PrBoxRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrBoxRequest" ADD CONSTRAINT "PrBoxRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tipos de notificación de las Cajas PR (ver notification-types.ts): se crean
-- acá para que los que van por correo salgan así desde el primer día.
INSERT INTO "NotificationTypeConfig" ("id", "key", "label", "audience", "channelEmail", "messageTemplate", "placeholders", "updatedAt") VALUES
('prboxproposed', 'PR_BOX_PROPOSED', 'Una marca te propuso su Caja PR', 'CREATOR', true, '{marca} te propone su Caja PR "{caja}". Mira el brief y acéptala en Marketplace → Cajas PR.', 'marca,caja', CURRENT_TIMESTAMP),
('prboxapproved', 'PR_BOX_APPROVED', 'Caja PR aprobada', 'CREATOR', true, '{marca} aprobó tu Caja PR "{caja}". {detalle}', 'marca,caja,detalle', CURRENT_TIMESTAMP),
('prboxrejected', 'PR_BOX_REJECTED', 'Caja PR no aprobada', 'CREATOR', true, '{marca} no puede enviarte la Caja PR "{caja}" esta vez.{razon}', 'marca,caja,razon', CURRENT_TIMESTAMP),
('prboxrequested', 'PR_BOX_REQUESTED', 'Una creadora pidió tu Caja PR', 'BRAND', true, '{creador} pidió tu Caja PR "{caja}". Apruébala o recházala en Muestras.', 'creador,caja', CURRENT_TIMESTAMP),
('prboxaccepted', 'PR_BOX_ACCEPTED', 'Una creadora aceptó tu Caja PR', 'BRAND', true, '{creador} aceptó tu Caja PR "{caja}". Ya puedes enviarla: la dirección está en Muestras.', 'creador,caja', CURRENT_TIMESTAMP),
('prboxdeclined', 'PR_BOX_DECLINED', 'Una creadora no aceptó tu Caja PR', 'BRAND', false, '{creador} no aceptó tu Caja PR "{caja}".', 'creador,caja', CURRENT_TIMESTAMP),
('prboxpublished', 'PR_BOX_PUBLISHED', 'Una creadora publicó con tu Caja PR', 'BRAND', true, '{creador} publicó su contenido con tu Caja PR "{caja}": {link}', 'creador,caja,link', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
