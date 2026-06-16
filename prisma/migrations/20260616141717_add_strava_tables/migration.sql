-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StravaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaAthleteId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StravaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaProfile" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lthrBpm" INTEGER,
    "cardiacDecouplingPct" DOUBLE PRECISION,
    "ctlScore" DOUBLE PRECISION,
    "atlScore" DOUBLE PRECISION,
    "bestEffort5kSeconds" INTEGER,
    "bestEffort10kSeconds" INTEGER,
    "paceZonesJson" JSONB,
    "runsPerWeek" DOUBLE PRECISION,
    "weeklyDistanceKm" DOUBLE PRECISION,
    "longestRunKm" DOUBLE PRECISION,
    "hardRunsPerWeek" DOUBLE PRECISION,
    "restDaysPerWeek" DOUBLE PRECISION,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_userId_key" ON "StravaConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_stravaAthleteId_key" ON "StravaConnection"("stravaAthleteId");

-- CreateIndex
CREATE INDEX "StravaConnection_userId_idx" ON "StravaConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaProfile_connectionId_key" ON "StravaProfile"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaProfile_userId_key" ON "StravaProfile"("userId");

-- CreateIndex
CREATE INDEX "StravaProfile_userId_idx" ON "StravaProfile"("userId");

-- AddForeignKey
ALTER TABLE "StravaConnection" ADD CONSTRAINT "StravaConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StravaProfile" ADD CONSTRAINT "StravaProfile_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "StravaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
