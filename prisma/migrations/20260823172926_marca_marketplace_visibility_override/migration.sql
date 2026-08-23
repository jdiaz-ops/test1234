-- CreateEnum
CREATE TYPE "MarketplaceVisibilityOverride" AS ENUM ('AUTO', 'FORCE_VISIBLE', 'FORCE_HIDDEN');

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "marketplaceVisibilityOverride" "MarketplaceVisibilityOverride" NOT NULL DEFAULT 'AUTO';
