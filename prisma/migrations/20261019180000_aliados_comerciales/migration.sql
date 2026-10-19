-- Aliados comerciales (ver AllyProfile en schema.prisma).

-- CreateEnum
CREATE TYPE "AllyStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AllyLeadKind" AS ENUM ('BRAND', 'CREATOR');

-- CreateEnum
CREATE TYPE "AllyLeadStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ALLY';

-- CreateTable
CREATE TABLE "AllyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "status" "AllyStatus" NOT NULL DEFAULT 'ACTIVE',
    "brandRateBps" INTEGER NOT NULL DEFAULT 250,
    "creatorRateBps" INTEGER NOT NULL DEFAULT 125,
    "windowMonths" INTEGER NOT NULL DEFAULT 6,
    "legalName" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "payoutMethod" "CreatorPayoutMethod",
    "breBKey" TEXT,
    "bankName" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AllyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllyLead" (
    "id" TEXT NOT NULL,
    "allyId" TEXT NOT NULL,
    "kind" "AllyLeadKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT NOT NULL,
    "instagram" TEXT,
    "city" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "AllyLeadStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllyLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllyReferral" (
    "id" TEXT NOT NULL,
    "allyId" TEXT NOT NULL,
    "leadId" TEXT,
    "brandId" TEXT,
    "creatorId" TEXT,
    "rateBps" INTEGER NOT NULL,
    "windowMonths" INTEGER NOT NULL,
    "firstSaleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllyReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllyPayout" (
    "id" TEXT NOT NULL,
    "allyId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT,
    CONSTRAINT "AllyPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllyLoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllyLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllyProfile_userId_key" ON "AllyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllyProfile_code_key" ON "AllyProfile"("code");

-- CreateIndex
CREATE INDEX "AllyLead_allyId_createdAt_idx" ON "AllyLead"("allyId", "createdAt");

-- CreateIndex
CREATE INDEX "AllyLead_status_idx" ON "AllyLead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AllyReferral_leadId_key" ON "AllyReferral"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "AllyReferral_brandId_key" ON "AllyReferral"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "AllyReferral_creatorId_key" ON "AllyReferral"("creatorId");

-- CreateIndex
CREATE INDEX "AllyReferral_allyId_idx" ON "AllyReferral"("allyId");

-- CreateIndex
CREATE UNIQUE INDEX "AllyPayout_allyId_period_key" ON "AllyPayout"("allyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "AllyLoginToken_tokenHash_key" ON "AllyLoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AllyLoginToken_userId_idx" ON "AllyLoginToken"("userId");

-- AddForeignKey
ALTER TABLE "AllyProfile" ADD CONSTRAINT "AllyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyLead" ADD CONSTRAINT "AllyLead_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "AllyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyReferral" ADD CONSTRAINT "AllyReferral_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "AllyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyReferral" ADD CONSTRAINT "AllyReferral_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "AllyLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyReferral" ADD CONSTRAINT "AllyReferral_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyReferral" ADD CONSTRAINT "AllyReferral_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyPayout" ADD CONSTRAINT "AllyPayout_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "AllyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
