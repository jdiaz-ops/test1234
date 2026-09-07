
-- CreateEnum
CREATE TYPE "StorefrontTemplate" AS ENUM ('CLASICA', 'MINIMAL', 'EDITORIAL');

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "storefrontTemplate" "StorefrontTemplate" NOT NULL DEFAULT 'CLASICA';

