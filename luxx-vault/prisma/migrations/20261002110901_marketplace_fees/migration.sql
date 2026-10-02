-- AlterTable
ALTER TABLE "trade" ADD COLUMN     "feeDueAt" TIMESTAMP(3),
ADD COLUMN     "feePaidAt" TIMESTAMP(3),
ADD COLUMN     "feePct" DECIMAL(5,2),
ADD COLUMN     "feePhp" DECIMAL(14,2),
ADD COLUMN     "feeRemindedAt" TIMESTAMP(3),
ADD COLUMN     "feeWaivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fee_payment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amountPhp" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'transfer',
    "reference" TEXT,
    "proofMediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_settings" (
    "id" TEXT NOT NULL DEFAULT 'market',
    "feePct" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "feeMinPhp" DECIMAL(14,2),
    "feeMaxPhp" DECIMAL(14,2),
    "feePayDays" INTEGER NOT NULL DEFAULT 7,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_payment_sellerId_createdAt_idx" ON "fee_payment"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "fee_payment_status_createdAt_idx" ON "fee_payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "trade_sellerId_feePaidAt_idx" ON "trade"("sellerId", "feePaidAt");

-- AddForeignKey
ALTER TABLE "fee_payment" ADD CONSTRAINT "fee_payment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
