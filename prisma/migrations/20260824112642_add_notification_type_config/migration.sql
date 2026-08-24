-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SENT', 'PENDING_REVIEW', 'DISCARDED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('CREATOR', 'BRAND', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SENT';

-- CreateTable
CREATE TABLE "NotificationTypeConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" "NotificationMode" NOT NULL DEFAULT 'AUTOMATIC',
    "channelApp" BOOLEAN NOT NULL DEFAULT true,
    "channelEmail" BOOLEAN NOT NULL DEFAULT false,
    "messageTemplate" TEXT NOT NULL,
    "placeholders" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTypeConfig_key_key" ON "NotificationTypeConfig"("key");
