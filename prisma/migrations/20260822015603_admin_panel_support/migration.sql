-- AlterTable
ALTER TABLE "CreatorProfile" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MonthlyOperatingCost" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyOperatingCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyOperatingCost_month_key" ON "MonthlyOperatingCost"("month");

-- CreateIndex
CREATE UNIQUE INDEX "LegalContent_key_key" ON "LegalContent"("key");
