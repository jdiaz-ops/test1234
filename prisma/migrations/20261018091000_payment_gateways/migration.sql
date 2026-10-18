-- Llaves de Mercado Pago, PayU, ePayco y Bold por marca; pasarela y datos
-- del pago por pedido; envío "se paga al recibir" (contraentrega).
ALTER TABLE "BrandProfile" ADD COLUMN "gatewayCredentials" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "StoreOrder"
  ADD COLUMN "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'WOMPI',
  ADD COLUMN "gatewayReference" TEXT,
  ADD COLUMN "gatewayTransactionId" TEXT,
  ADD COLUMN "gatewayStatus" TEXT,
  ADD COLUMN "shippingPayOnDelivery" BOOLEAN NOT NULL DEFAULT false;

-- Los pedidos viejos (todos de Wompi) quedan con los campos genéricos llenos.
UPDATE "StoreOrder"
SET "gatewayTransactionId" = "wompiTransactionId", "gatewayStatus" = "wompiStatus"
WHERE "wompiTransactionId" IS NOT NULL;

CREATE INDEX "StoreOrder_gatewayReference_idx" ON "StoreOrder"("gatewayReference");

ALTER TABLE "ShippingZoneRate" ADD COLUMN "payOnDelivery" BOOLEAN NOT NULL DEFAULT false;

-- Tarifas en $0 cuyo nombre dice que el envío se paga al recibir.
UPDATE "ShippingZoneRate"
SET "payOnDelivery" = true
WHERE "price" = 0
  AND "name" ~* '(contra\s*-?\s*entrega|al\s+recibir|pag[aá]s?\s+(el\s+)?(env[ií]o|flete)|cobro\s+en\s+destino|flete\s+(al\s+)?destino|pago\s+en\s+destino)';

ALTER TABLE "PaymentGatewayRequest" ADD COLUMN "notifiedReadyAt" TIMESTAMP(3);
