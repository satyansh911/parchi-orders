-- D108–D111: salesman role, van routes, photo/voice capture, offline timing.
ALTER TYPE "Role" ADD VALUE 'SALESMAN';
ALTER TYPE "OrderSource" ADD VALUE 'SALESMAN';

CREATE TYPE "CaptureInput" AS ENUM ('TEXT', 'PHOTO', 'VOICE');
ALTER TABLE "Capture" ADD COLUMN "inputType" "CaptureInput" NOT NULL DEFAULT 'TEXT';

CREATE TABLE "Van" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Van_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Van_code_key" ON "Van"("code");

ALTER TABLE "Retailer" ADD COLUMN "salesmanId" TEXT;
ALTER TABLE "Retailer" ADD COLUMN "vanId" TEXT;
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_vanId_fkey" FOREIGN KEY ("vanId") REFERENCES "Van"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "takenAt" TIMESTAMP(3);
CREATE INDEX "Order_status_approvedAt_idx" ON "Order"("status", "approvedAt");
