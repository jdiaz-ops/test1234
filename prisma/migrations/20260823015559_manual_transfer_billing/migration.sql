-- Reemplaza el cobro automático con tarjeta (ePayco) por el corte mensual
-- de transferencia manual (QR/Bre-B) + comprobante verificado a mano.

-- AlterEnum: PENDING se mantiene igual; CHARGED -> PAID, FAILED -> PENDING
-- (un corte fallido con el modelo viejo no tiene equivalente real en el
-- nuevo — se deja como PENDING para que, si tenía comisiones asociadas,
-- vuelva a quedar visible como un corte por regularizar).
BEGIN;
CREATE TYPE "BrandChargeStatus_new" AS ENUM ('PENDING', 'PROOF_SUBMITTED', 'PAID', 'OVERDUE');
ALTER TABLE "BrandCharge" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BrandCharge" ALTER COLUMN "status" TYPE "BrandChargeStatus_new" USING (
  CASE status::text
    WHEN 'CHARGED' THEN 'PAID'
    WHEN 'FAILED' THEN 'PENDING'
    ELSE status::text
  END::"BrandChargeStatus_new"
);
ALTER TYPE "BrandChargeStatus" RENAME TO "BrandChargeStatus_old";
ALTER TYPE "BrandChargeStatus_new" RENAME TO "BrandChargeStatus";
DROP TYPE "BrandChargeStatus_old";
ALTER TABLE "BrandCharge" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable: BrandCharge — nuevas columnas del flujo de transferencia
-- manual. dueAt es NOT NULL, así que para cortes ya existentes se rellena
-- primero con createdAt + 72h antes de aplicar la restricción.
ALTER TABLE "BrandCharge" DROP COLUMN "chargedAt",
DROP COLUMN "epaycoTransactionRef",
DROP COLUMN "failureReason",
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "proofRejectedAt" TIMESTAMP(3),
ADD COLUMN     "proofRejectedReason" TEXT,
ADD COLUMN     "proofSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "verifiedByUserId" TEXT;

UPDATE "BrandCharge" SET "dueAt" = "createdAt" + INTERVAL '72 hours' WHERE "dueAt" IS NULL;
-- Un corte ya PAID (remapeado de CHARGED) también queda con dueAt en el
-- pasado — no importa, isBrandPaymentLocked ignora los que ya están PAID.
ALTER TABLE "BrandCharge" ALTER COLUMN "dueAt" SET NOT NULL;

-- AlterTable: BrandProfile — ya no hay tarjeta guardada.
ALTER TABLE "BrandProfile" DROP COLUMN "cardTokenRef",
ADD COLUMN     "billingAcknowledgedAt" TIMESTAMP(3);

-- AlterTable: PlatformConfig — instrucciones de pago y plazo de gracia.
ALTER TABLE "PlatformConfig" ADD COLUMN     "paymentGraceHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "paymentQrImageUrl" TEXT;
