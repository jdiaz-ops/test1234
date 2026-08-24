-- AlterEnum
ALTER TYPE "ChallengeType" ADD VALUE 'TEMP_DISCOUNT_BOOST';

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "discountBoostActive" BOOLEAN NOT NULL DEFAULT false;
