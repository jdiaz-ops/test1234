
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ServiceModality" AS ENUM ('VIRTUAL', 'PRESENCIAL');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "serviceDurationMinutes" INTEGER,
ADD COLUMN     "serviceLocation" TEXT,
ADD COLUMN     "serviceModality" "ServiceModality",
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL';

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "servicePreferredAt" TIMESTAMP(3),
ALTER COLUMN "shippingAddress" DROP NOT NULL,
ALTER COLUMN "shippingCity" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StoreOrderItem" ADD COLUMN     "serviceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "serviceMeetingInfo" TEXT;

