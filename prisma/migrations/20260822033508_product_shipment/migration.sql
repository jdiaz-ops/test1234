-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('REQUESTED', 'SENT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ShipmentRequestedBy" AS ENUM ('CREATOR', 'BRAND');

-- CreateTable
CREATE TABLE "ProductShipment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "requestedBy" "ShipmentRequestedBy" NOT NULL,
    "description" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductShipment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductShipment" ADD CONSTRAINT "ProductShipment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CreatorOfferEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
