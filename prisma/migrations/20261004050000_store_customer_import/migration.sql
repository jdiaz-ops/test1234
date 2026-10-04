-- Importador de clientes desde Shopify (2026-10-04).
ALTER TABLE "StoreCustomer"
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "company" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "address2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "countryCode" TEXT,
  ADD COLUMN "smsSubscribed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "importedOrderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "importedSpentCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shopifyCustomerId" TEXT,
  ADD COLUMN "importedAt" TIMESTAMP(3);
