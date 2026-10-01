-- Checkout de una página: nombre y apellidos, código postal, tarifa de
-- envío, dirección de facturación distinta y novedades por correo.
ALTER TABLE "StoreOrder" ADD COLUMN "billingAddress" TEXT,
ADD COLUMN "billingCity" TEXT,
ADD COLUMN "billingRegion" TEXT,
ADD COLUMN "buyerFirstName" TEXT,
ADD COLUMN "buyerLastName" TEXT,
ADD COLUMN "shippingPostalCode" TEXT,
ADD COLUMN "shippingMethod" TEXT,
ADD COLUMN "acceptsMarketing" BOOLEAN NOT NULL DEFAULT false;
