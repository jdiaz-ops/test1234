-- CreateEnum
CREATE TYPE "ShippingRateCondition" AS ENUM ('NONE', 'MIN_ORDER_AMOUNT', 'MIN_WEIGHT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "weight" DECIMAL(8,3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "weight" DECIMAL(8,3);

-- CreateTable
CREATE TABLE "ShippingZoneRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "condition" "ShippingRateCondition" NOT NULL DEFAULT 'NONE',
    "conditionValue" DECIMAL(12,3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingZoneRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingZoneRate_zoneId_idx" ON "ShippingZoneRate"("zoneId");

-- AddForeignKey
ALTER TABLE "ShippingZoneRate" ADD CONSTRAINT "ShippingZoneRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: convierte cada zona existente (price + freeShippingThreshold
-- simples) en sus ShippingZoneRate equivalentes, antes de borrar esas
-- columnas — ninguna zona ya creada pierde su tarifa.
INSERT INTO "ShippingZoneRate" ("id", "zoneId", "name", "price", "condition", "conditionValue", "position", "createdAt")
SELECT gen_random_uuid()::text, "id", 'Envío estándar', "price", 'NONE', NULL, 0, now()
FROM "ShippingZone";

INSERT INTO "ShippingZoneRate" ("id", "zoneId", "name", "price", "condition", "conditionValue", "position", "createdAt")
SELECT gen_random_uuid()::text, "id", 'Envío gratis', 0, 'MIN_ORDER_AMOUNT', "freeShippingThreshold", 1, now()
FROM "ShippingZone"
WHERE "freeShippingThreshold" IS NOT NULL;

-- AlterTable
ALTER TABLE "ShippingZone" DROP COLUMN "freeShippingThreshold",
DROP COLUMN "price";
