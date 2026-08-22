-- CreateTable
CREATE TABLE "ImpersonationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationToken_token_key" ON "ImpersonationToken"("token");
