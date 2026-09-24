-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SELLER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" TEXT,
    "bio" TEXT,
    "stripeAccountId" TEXT,
    "stripeReady" BOOLEAN NOT NULL DEFAULT false,
    "targetProfitCents" INTEGER NOT NULL DEFAULT 3000,
    "shipOutCents" INTEGER NOT NULL DEFAULT 1200,
    "cleanCostCents" INTEGER NOT NULL DEFAULT 800,
    "restoreCostCents" INTEGER NOT NULL DEFAULT 1800,
    "buyerShippingCents" INTEGER NOT NULL DEFAULT 1200,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 0,
    "isReseller" BOOLEAN NOT NULL DEFAULT false,
    "commissionBps" INTEGER NOT NULL DEFAULT 3000,
    "isHolder" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT,
    "holderBps" INTEGER NOT NULL DEFAULT 1500,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SELLER',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "fixedFeeCents" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shoe" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "colorway" TEXT,
    "styleCode" TEXT,
    "nickname" TEXT,
    "retailCents" INTEGER,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shoe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "shoeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "sizeType" TEXT NOT NULL DEFAULT 'M',
    "grade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SOURCING',
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "acquiredFrom" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "listPriceCents" INTEGER,
    "estAsIsCents" INTEGER,
    "estCleanCents" INTEGER,
    "estRestoredCents" INTEGER,
    "resellerPriceCents" INTEGER,
    "marketNewCents" INTEGER,
    "flaws" TEXT,
    "flawNotes" TEXT,
    "ratingOverall" INTEGER,
    "ratingUpper" INTEGER,
    "ratingMidsole" INTEGER,
    "ratingOutsole" INTEGER,
    "ratingInsole" INTEGER,
    "ratingSmell" INTEGER,
    "holderId" TEXT,
    "listedAt" TIMESTAMP(3),
    "restorationEta" TIMESTAMP(3),
    "restorationNotes" TEXT,
    "treatments" TEXT,
    "notes" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPhoto" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comp" (
    "id" TEXT NOT NULL,
    "shoeId" TEXT,
    "itemId" TEXT,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "size" TEXT,
    "grade" TEXT,
    "url" TEXT,
    "note" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipState" TEXT,
    "shipPostal" TEXT,
    "shipCountry" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "resellerId" TEXT,
    "resellerCutCents" INTEGER NOT NULL DEFAULT 0,
    "soldById" TEXT,
    "sellerCutCents" INTEGER NOT NULL DEFAULT 0,
    "holderCutCents" INTEGER NOT NULL DEFAULT 0,
    "fulfillment" TEXT NOT NULL DEFAULT 'SHIPPING',
    "pickupLocationId" TEXT,
    "pickupAt" TIMESTAMP(3),
    "handedOverAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "trackingCarrier" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeAlert" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "sizeType" TEXT NOT NULL DEFAULT 'M',
    "forWho" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "SizeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT,
    "startCents" INTEGER NOT NULL,
    "reserveCents" INTEGER,
    "incrementCents" INTEGER NOT NULL DEFAULT 500,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderEmail" TEXT NOT NULL,
    "bidderName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestorationRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "shoeDescription" TEXT NOT NULL,
    "condition" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "quoteCents" INTEGER,
    "etaDate" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestorationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "notes" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "holderId" TEXT,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    "condition" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "offerCents" INTEGER,
    "creditCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Channel_userId_idx" ON "Channel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shoe_styleCode_key" ON "Shoe"("styleCode");

-- CreateIndex
CREATE INDEX "Shoe_brand_model_idx" ON "Shoe"("brand", "model");

-- CreateIndex
CREATE INDEX "InventoryItem_sellerId_status_idx" ON "InventoryItem"("sellerId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_status_size_idx" ON "InventoryItem"("status", "size");

-- CreateIndex
CREATE INDEX "ItemPhoto_itemId_idx" ON "ItemPhoto"("itemId");

-- CreateIndex
CREATE INDEX "Comp_shoeId_idx" ON "Comp"("shoeId");

-- CreateIndex
CREATE INDEX "Comp_itemId_idx" ON "Comp"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SizeAlert_size_idx" ON "SizeAlert"("size");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Bid_auctionId_amountCents_idx" ON "Bid"("auctionId", "amountCents");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_email_idx" ON "PushSubscription"("email");

-- CreateIndex
CREATE INDEX "PickupLocation_active_dayOfWeek_idx" ON "PickupLocation"("active", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TradeIn_status_idx" ON "TradeIn"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_shoeId_fkey" FOREIGN KEY ("shoeId") REFERENCES "Shoe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPhoto" ADD CONSTRAINT "ItemPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comp" ADD CONSTRAINT "Comp_shoeId_fkey" FOREIGN KEY ("shoeId") REFERENCES "Shoe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comp" ADD CONSTRAINT "Comp_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PickupLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLocation" ADD CONSTRAINT "PickupLocation_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

