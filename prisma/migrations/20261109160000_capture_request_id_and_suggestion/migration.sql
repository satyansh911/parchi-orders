-- D96: interpretation idempotency key; D97: the reviewed suggestion, kept
-- separate from the model's own pick and from the retailer's resolution.
-- Additive only.
ALTER TABLE "Capture" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "Capture_clientRequestId_key" ON "Capture"("clientRequestId");
ALTER TABLE "CaptureLine" ADD COLUMN "suggestedSkuId" TEXT;
ALTER TABLE "CaptureLine" ADD COLUMN "suggestedCases" INTEGER;
