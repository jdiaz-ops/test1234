-- AlterEnum
ALTER TYPE "BrandChargeStatus" ADD VALUE 'DEACTIVATED';

-- AlterTable
ALTER TABLE "BrandCharge" ADD COLUMN     "deactivationDueAt" TIMESTAMP(3),
ADD COLUMN     "deactivationReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "deactivationGraceHours" INTEGER NOT NULL DEFAULT 72;
