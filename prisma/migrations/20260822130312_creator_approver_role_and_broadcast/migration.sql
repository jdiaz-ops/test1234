-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('BRANDS', 'CREATORS');

-- CreateEnum
CREATE TYPE "BroadcastChannel" AS ENUM ('EMAIL', 'NOTIFICATION');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'CREATOR_APPROVER';

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "channel" "BroadcastChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);
