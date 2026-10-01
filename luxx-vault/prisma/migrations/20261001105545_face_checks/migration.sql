-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "faceLockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "face_check" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "passed" BOOLEAN NOT NULL,
    "livenessScore" DOUBLE PRECISION,
    "faceMatchScore" DOUBLE PRECISION,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_check_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_check_userId_createdAt_idx" ON "face_check"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "face_check" ADD CONSTRAINT "face_check_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
