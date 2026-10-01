-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metal" TEXT,
    "karat" INTEGER,
    "finenessPermille" INTEGER,
    "goldType" TEXT,
    "form" TEXT,
    "weightGrams" DECIMAL(10,3) NOT NULL,
    "pricingMode" TEXT NOT NULL DEFAULT 'fixed',
    "pricePhp" DECIMAL(14,2),
    "premiumPct" DECIMAL(6,2),
    "description" TEXT NOT NULL,
    "hasCertificate" BOOLEAN NOT NULL DEFAULT false,
    "pawnable" BOOLEAN,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "layawayAllowed" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "shop_order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "plan" TEXT NOT NULL DEFAULT 'full',
    "paymentMethod" TEXT NOT NULL,
    "fulfilment" TEXT NOT NULL,
    "branch" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine" TEXT,
    "regionCode" TEXT,
    "provinceCode" TEXT,
    "cityCode" TEXT,
    "buyerNote" TEXT,
    "subtotalPhp" DECIMAL(14,2) NOT NULL,
    "deliveryFeePhp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPhp" DECIMAL(14,2) NOT NULL,
    "paidPhp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "downPaymentPhp" DECIMAL(14,2),
    "payBy" TIMESTAMP(3),
    "courier" TEXT,
    "trackingNumber" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metal" TEXT,
    "karat" INTEGER,
    "weightGrams" DECIMAL(10,3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePhp" DECIMAL(14,2) NOT NULL,
    "coverMediaId" TEXT,

    CONSTRAINT "shop_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountPhp" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "proofMediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_installment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountPhp" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "shop_installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL DEFAULT 'shop',
    "paymentInstructions" TEXT,
    "reserveDays" INTEGER NOT NULL DEFAULT 3,
    "layawayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "layawayDownPct" INTEGER NOT NULL DEFAULT 30,
    "layawayMonths" INTEGER NOT NULL DEFAULT 3,
    "layawayMinPhp" DECIMAL(14,2) NOT NULL DEFAULT 5000,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codMaxPhp" DECIMAL(14,2),
    "deliveryFeePhp" DECIMAL(14,2),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_code_key" ON "product"("code");

-- CreateIndex
CREATE INDEX "product_status_featured_createdAt_idx" ON "product"("status", "featured", "createdAt");

-- CreateIndex
CREATE INDEX "product_image_productId_position_idx" ON "product_image"("productId", "position");

-- CreateIndex
CREATE INDEX "product_image_mediaId_idx" ON "product_image"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_order_code_key" ON "shop_order"("code");

-- CreateIndex
CREATE INDEX "shop_order_status_createdAt_idx" ON "shop_order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shop_order_buyerId_createdAt_idx" ON "shop_order"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "shop_order_item_orderId_idx" ON "shop_order_item"("orderId");

-- CreateIndex
CREATE INDEX "shop_payment_orderId_createdAt_idx" ON "shop_payment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "shop_payment_status_createdAt_idx" ON "shop_payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shop_installment_paidAt_dueAt_idx" ON "shop_installment"("paidAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "shop_installment_orderId_seq_key" ON "shop_installment"("orderId", "seq");

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_item" ADD CONSTRAINT "shop_order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_item" ADD CONSTRAINT "shop_order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_payment" ADD CONSTRAINT "shop_payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_installment" ADD CONSTRAINT "shop_installment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
