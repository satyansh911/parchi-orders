-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RETAILER', 'DESK');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('HI', 'EN');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PIECE', 'CASE');

-- CreateEnum
CREATE TYPE "SchemeType" AS ENUM ('FREE_GOODS', 'SLAB_DISCOUNT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CREDIT_HOLD', 'REVIEW_REQUIRED', 'APPROVED', 'CANCELLED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('CATALOGUE', 'REPEAT', 'AI_CAPTURE');

-- CreateEnum
CREATE TYPE "OfferSelection" AS ENUM ('BEST_OFFER', 'DISCOUNT_FREE_GOODS_SHORT');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('PARSED', 'FAILED', 'CONFIRMED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NEEDS_CLARIFICATION');

-- CreateEnum
CREATE TYPE "CaptureLineResolution" AS ENUM ('PENDING', 'ACCEPTED', 'CORRECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('PLACED', 'STATUS_CHANGED', 'LINE_ADDED', 'LINE_EDITED', 'LINE_REMOVED', 'LINE_RESOLVED', 'NOTE', 'CANCEL_REQUESTED', 'ACK_REQUESTED', 'ACK_ACCEPTED', 'EXPORTED');

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountBps" INTEGER NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "creditLimitPaise" INTEGER NOT NULL,
    "outstandingPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "retailerId" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'HI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "piecesPerCase" INTEGER NOT NULL,
    "dealerPricePaise" INTEGER NOT NULL,
    "dealerPriceUnit" "PriceUnit" NOT NULL DEFAULT 'PIECE',
    "mrpPaise" INTEGER,
    "gstBps" INTEGER NOT NULL,
    "stockCases" INTEGER NOT NULL,
    "reservedCases" INTEGER NOT NULL DEFAULT 0,
    "imageKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "type" "SchemeType" NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelHi" TEXT NOT NULL,
    "buyCases" INTEGER,
    "freeCases" INTEGER,
    "minCases" INTEGER,
    "discountBps" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "placedById" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "gstPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "originalTotalPaise" INTEGER NOT NULL,
    "creditLimitPaise" INTEGER NOT NULL,
    "availableCreditPaise" INTEGER NOT NULL,
    "overLimitPaise" INTEGER NOT NULL,
    "creditCheckedAt" TIMESTAMP(3) NOT NULL,
    "awaitingRetailerAck" BOOLEAN NOT NULL DEFAULT false,
    "ackRequestedAt" TIMESTAMP(3),
    "ackAcceptedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "reason" TEXT,
    "captureId" TEXT,
    "exportBatchId" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "exportedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "paidCases" INTEGER NOT NULL,
    "freeCases" INTEGER NOT NULL,
    "casePricePaise" INTEGER NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "gstBps" INTEGER NOT NULL,
    "gstPaise" INTEGER NOT NULL,
    "lineTotalPaise" INTEGER NOT NULL,
    "freeValuePaise" INTEGER NOT NULL,
    "appliedSchemeId" TEXT,
    "appliedLabel" TEXT,
    "otherOfferLabel" TEXT,
    "offerSelection" "OfferSelection" NOT NULL DEFAULT 'BEST_OFFER',
    "captureLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "OrderEventType" NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "reason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "model" TEXT,
    "aiResponse" JSONB,
    "status" "CaptureStatus" NOT NULL,
    "failReason" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureLine" (
    "id" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "aiSkuId" TEXT,
    "aiQty" INTEGER,
    "aiUnit" TEXT,
    "aiScore" INTEGER,
    "finalScore" INTEGER,
    "confidence" "Confidence" NOT NULL,
    "alternativeSkuIds" TEXT[],
    "flags" TEXT[],
    "note" TEXT,
    "resolution" "CaptureLineResolution" NOT NULL DEFAULT 'PENDING',
    "resolvedSkuId" TEXT,
    "resolvedCases" INTEGER,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CaptureLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "phraseNormalized" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "createdById" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "csv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_code_key" ON "PriceTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_code_key" ON "Retailer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_code_key" ON "Sku"("code");

-- CreateIndex
CREATE INDEX "Sku_categoryId_idx" ON "Sku"("categoryId");

-- CreateIndex
CREATE INDEX "Scheme_skuId_idx" ON "Scheme"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientRequestId_key" ON "Order"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_captureId_key" ON "Order"("captureId");

-- CreateIndex
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");

-- CreateIndex
CREATE INDEX "Order_retailerId_placedAt_idx" ON "Order"("retailerId", "placedAt");

-- CreateIndex
CREATE INDEX "Order_awaitingRetailerAck_idx" ON "Order"("awaitingRetailerAck");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_captureLineId_key" ON "OrderLine"("captureLineId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Capture_retailerId_createdAt_idx" ON "Capture"("retailerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureLine_captureId_position_key" ON "CaptureLine"("captureId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_retailerId_phraseNormalized_key" ON "Alias"("retailerId", "phraseNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "ExportBatch_number_key" ON "ExportBatch"("number");

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PriceTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scheme" ADD CONSTRAINT "Scheme_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_exportBatchId_fkey" FOREIGN KEY ("exportBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_appliedSchemeId_fkey" FOREIGN KEY ("appliedSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_captureLineId_fkey" FOREIGN KEY ("captureLineId") REFERENCES "CaptureLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureLine" ADD CONSTRAINT "CaptureLine_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureLine" ADD CONSTRAINT "CaptureLine_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Business invariants Prisma cannot express ──────────────────────────────
-- These are the last line of defence; the domain and server code check first.

-- Stock (D4): reserved stock can never exceed physical stock, nothing goes negative.
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_stock_check"
  CHECK ("stockCases" >= 0 AND "reservedCases" >= 0 AND "reservedCases" <= "stockCases");
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_values_check"
  CHECK ("piecesPerCase" > 0 AND "dealerPricePaise" > 0
         AND "gstBps" BETWEEN 0 AND 10000
         AND ("mrpPaise" IS NULL OR "mrpPaise" > 0));

-- Tier discount is a valid percentage (D5).
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_discount_check"
  CHECK ("discountBps" BETWEEN 0 AND 10000);

-- Each scheme type uses only its own columns (A.3, A.4).
ALTER TABLE "Scheme" ADD CONSTRAINT "Scheme_shape_check" CHECK (
  ("type" = 'FREE_GOODS'
     AND "buyCases" > 0 AND "freeCases" > 0
     AND "minCases" IS NULL AND "discountBps" IS NULL)
  OR
  ("type" = 'SLAB_DISCOUNT'
     AND "minCases" > 0 AND "discountBps" BETWEEN 1 AND 10000
     AND "buyCases" IS NULL AND "freeCases" IS NULL)
);
ALTER TABLE "Scheme" ADD CONSTRAINT "Scheme_dates_check"
  CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt");

-- Credit values are never negative (A.6).
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_credit_check"
  CHECK ("creditLimitPaise" >= 0 AND "outstandingPaise" >= 0);

-- A retailer user always belongs to a retailer; a desk user never does.
ALTER TABLE "User" ADD CONSTRAINT "User_role_retailer_check"
  CHECK (("role" = 'RETAILER') = ("retailerId" IS NOT NULL));

-- Order and line money is non-negative; lines are whole positive cases (C.4).
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check"
  CHECK ("taxablePaise" >= 0 AND "discountPaise" >= 0 AND "gstPaise" >= 0
         AND "totalPaise" >= 0 AND "originalTotalPaise" >= 0
         AND "creditLimitPaise" >= 0 AND "overLimitPaise" >= 0);
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_values_check"
  CHECK ("paidCases" > 0 AND "freeCases" >= 0
         AND "casePricePaise" >= 0 AND "taxablePaise" >= 0
         AND "discountBps" BETWEEN 0 AND 10000 AND "discountPaise" >= 0
         AND "gstBps" BETWEEN 0 AND 10000 AND "gstPaise" >= 0
         AND "lineTotalPaise" >= 0 AND "freeValuePaise" >= 0);

-- Export batches and rate-limit counters.
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_values_check"
  CHECK ("orderCount" > 0 AND "totalPaise" >= 0);
ALTER TABLE "RateLimitHit" ADD CONSTRAINT "RateLimitHit_count_check"
  CHECK ("count" > 0);
