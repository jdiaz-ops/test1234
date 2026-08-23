
-- CreateTable
CREATE TABLE "CreatorBadge" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeUrgencyPing" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeUrgencyPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorBadge_creatorId_badgeKey_key" ON "CreatorBadge"("creatorId", "badgeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeUrgencyPing_challengeId_creatorId_window_key" ON "ChallengeUrgencyPing"("challengeId", "creatorId", "window");

-- AddForeignKey
ALTER TABLE "CreatorBadge" ADD CONSTRAINT "CreatorBadge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeUrgencyPing" ADD CONSTRAINT "ChallengeUrgencyPing_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeUrgencyPing" ADD CONSTRAINT "ChallengeUrgencyPing_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

