-- D89: the credit check sums a retailer's open orders:
--   WHERE "retailerId" = $1 AND status IN ('PENDING_REVIEW','CREDIT_HOLD','REVIEW_REQUIRED','APPROVED')
-- ("retailerId", "placedAt") would read all of the retailer's orders; this
-- index matches the filter directly. Additive only.
CREATE INDEX "Order_retailerId_status_idx" ON "Order"("retailerId", "status");
