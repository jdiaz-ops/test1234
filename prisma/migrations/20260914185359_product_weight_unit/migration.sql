-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'G', 'LB', 'OZ');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'KG';
