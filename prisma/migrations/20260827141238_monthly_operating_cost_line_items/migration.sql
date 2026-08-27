/*
  Warnings:

  - You are about to drop the column `note` on the `MonthlyOperatingCost` table. All the data in the column will be lost.
  - Added the required column `label` to the `MonthlyOperatingCost` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MonthlyOperatingCost_month_key";

-- AlterTable
ALTER TABLE "MonthlyOperatingCost" DROP COLUMN "note",
ADD COLUMN     "label" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "MonthlyOperatingCost_month_idx" ON "MonthlyOperatingCost"("month");
