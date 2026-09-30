-- CreateTable
CREATE TABLE "profile" (
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "regionCode" TEXT,
    "provinceCode" TEXT,
    "cityCode" TEXT,
    "businessName" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER,
    "identityVerifiedAt" TIMESTAMP(3),
    "sellerVerifiedAt" TIMESTAMP(3),
    "showroomTagline" TEXT,
    "coverMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "phone_otp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "idType" TEXT,
    "idNumberLast4" TEXT,
    "nameOnId" TEXT,
    "birthYear" INTEGER,
    "idExpiry" TIMESTAMP(3),
    "addressProofKind" TEXT,
    "businessRegKind" TEXT,
    "payoutMasked" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "livenessScore" DOUBLE PRECISION,
    "faceMatchScore" DOUBLE PRECISION,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionReason" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshot" (
    "id" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "usdPerOz" DECIMAL(12,4) NOT NULL,
    "usdPhp" DECIMAL(10,4) NOT NULL,
    "phpPerGram" DECIMAL(12,4) NOT NULL,
    "source" TEXT NOT NULL,
    "fxSource" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_daily" (
    "metal" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "usdPerOz" DECIMAL(12,4) NOT NULL,
    "usdPhp" DECIMAL(10,4),
    "phpPerGram" DECIMAL(12,4),
    "source" TEXT NOT NULL,

    CONSTRAINT "price_daily_pkey" PRIMARY KEY ("metal","day")
);

-- CreateTable
CREATE TABLE "spread" (
    "id" TEXT NOT NULL,
    "metal" TEXT NOT NULL DEFAULT 'gold',
    "purity" INTEGER NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'jewelry',
    "buyRatio" DECIMAL(6,4) NOT NULL,
    "sellRatio" DECIMAL(6,4) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "karat" INTEGER,
    "direction" TEXT NOT NULL,
    "targetPhpPerGram" DECIMAL(12,2) NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['email', 'in_app']::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_object" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA,
    "url" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "phash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_object_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
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
    "openToOffers" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "hasCertificate" BOOLEAN NOT NULL DEFAULT false,
    "hasReceipt" BOOLEAN NOT NULL DEFAULT false,
    "pawnable" BOOLEAN,
    "regionCode" TEXT NOT NULL,
    "provinceCode" TEXT,
    "cityCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "declaredOwnerAt" TIMESTAMP(3) NOT NULL,
    "luxxTestedAt" TIMESTAMP(3),
    "luxxTestResult" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_image" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "duplicateOfListingId" TEXT,

    CONSTRAINT "listing_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_request" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metal" TEXT,
    "karat" INTEGER,
    "goldType" TEXT,
    "form" TEXT,
    "minGrams" DECIMAL(10,3),
    "maxGrams" DECIMAL(10,3),
    "budgetMaxPhp" DECIMAL(14,2),
    "description" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "provinceCode" TEXT,
    "cityCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buy_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "buyRequestId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amountPhp" DECIMAL(14,2) NOT NULL,
    "weightGrams" DECIMAL(10,3),
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "counterOfId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "buyRequestId" TEXT,
    "tradeId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_participant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'user',
    "body" TEXT NOT NULL,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "listingId" TEXT,
    "buyRequestId" TEXT,
    "offerId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amountPhp" DECIMAL(14,2) NOT NULL,
    "category" TEXT NOT NULL,
    "metal" TEXT,
    "karat" INTEGER,
    "goldType" TEXT,
    "form" TEXT,
    "weightGrams" DECIMAL(10,3) NOT NULL,
    "regionCode" TEXT NOT NULL,
    "cityCode" TEXT,
    "fulfilment" TEXT NOT NULL DEFAULT 'shipping',
    "trackingNumber" TEXT,
    "courier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "paymentProvider" TEXT NOT NULL DEFAULT 'mock',
    "paymentRef" TEXT,
    "autoReleaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "hideFromTape" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "evidenceMediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_listing" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listing_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "sell_quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "karat" INTEGER,
    "finenessPermille" INTEGER,
    "weightGrams" DECIMAL(10,3) NOT NULL,
    "estimatePhp" DECIMAL(14,2) NOT NULL,
    "branch" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sell_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "linkCode" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "deliveredVia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_outbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_handle_key" ON "profile"("handle");

-- CreateIndex
CREATE INDEX "profile_regionCode_cityCode_idx" ON "profile"("regionCode", "cityCode");

-- CreateIndex
CREATE INDEX "phone_otp_userId_createdAt_idx" ON "phone_otp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "kyc_submission_status_createdAt_idx" ON "kyc_submission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "kyc_submission_userId_level_idx" ON "kyc_submission"("userId", "level");

-- CreateIndex
CREATE INDEX "price_snapshot_metal_createdAt_idx" ON "price_snapshot"("metal", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "spread_metal_purity_productType_key" ON "spread"("metal", "purity", "productType");

-- CreateIndex
CREATE INDEX "price_alert_active_metal_idx" ON "price_alert"("active", "metal");

-- CreateIndex
CREATE INDEX "price_alert_userId_idx" ON "price_alert"("userId");

-- CreateIndex
CREATE INDEX "media_object_phash_idx" ON "media_object"("phash");

-- CreateIndex
CREATE INDEX "media_object_ownerId_createdAt_idx" ON "media_object"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_code_key" ON "listing"("code");

-- CreateIndex
CREATE INDEX "listing_status_category_createdAt_idx" ON "listing"("status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "listing_sellerId_status_idx" ON "listing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "listing_regionCode_cityCode_idx" ON "listing"("regionCode", "cityCode");

-- CreateIndex
CREATE INDEX "listing_image_listingId_position_idx" ON "listing_image"("listingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "buy_request_code_key" ON "buy_request"("code");

-- CreateIndex
CREATE INDEX "buy_request_status_category_createdAt_idx" ON "buy_request"("status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "buy_request_buyerId_status_idx" ON "buy_request"("buyerId", "status");

-- CreateIndex
CREATE INDEX "offer_toUserId_status_idx" ON "offer"("toUserId", "status");

-- CreateIndex
CREATE INDEX "offer_fromUserId_status_idx" ON "offer"("fromUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_tradeId_key" ON "conversation"("tradeId");

-- CreateIndex
CREATE INDEX "conversation_lastMessageAt_idx" ON "conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "conversation_participant_userId_idx" ON "conversation_participant"("userId");

-- CreateIndex
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trade_code_key" ON "trade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "trade_offerId_key" ON "trade"("offerId");

-- CreateIndex
CREATE INDEX "trade_status_releasedAt_idx" ON "trade"("status", "releasedAt");

-- CreateIndex
CREATE INDEX "trade_buyerId_idx" ON "trade"("buyerId");

-- CreateIndex
CREATE INDEX "trade_sellerId_idx" ON "trade"("sellerId");

-- CreateIndex
CREATE INDEX "review_subjectId_createdAt_idx" ON "review"("subjectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_tradeId_authorId_key" ON "review"("tradeId", "authorId");

-- CreateIndex
CREATE INDEX "dispute_status_createdAt_idx" ON "dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_status_createdAt_idx" ON "report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_targetType_targetId_idx" ON "report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "sell_quote_status_createdAt_idx" ON "sell_quote"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channel_linkCode_key" ON "notification_channel"("linkCode");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channel_userId_kind_key" ON "notification_channel"("userId", "kind");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "dev_outbox_channel_createdAt_idx" ON "dev_outbox"("channel", "createdAt");

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_otp" ADD CONSTRAINT "phone_otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submission" ADD CONSTRAINT "kyc_submission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_object" ADD CONSTRAINT "media_object_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_request" ADD CONSTRAINT "buy_request_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_buyRequestId_fkey" FOREIGN KEY ("buyRequestId") REFERENCES "buy_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyRequestId_fkey" FOREIGN KEY ("buyRequestId") REFERENCES "buy_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participant" ADD CONSTRAINT "conversation_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_buyRequestId_fkey" FOREIGN KEY ("buyRequestId") REFERENCES "buy_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listing" ADD CONSTRAINT "saved_listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listing" ADD CONSTRAINT "saved_listing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_quote" ADD CONSTRAINT "sell_quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
