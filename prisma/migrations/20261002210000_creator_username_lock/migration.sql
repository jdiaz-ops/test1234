-- Username del creador fijo después de confirmarlo
ALTER TABLE "CreatorProfile" ADD COLUMN "displayNameLockedAt" TIMESTAMP(3);
