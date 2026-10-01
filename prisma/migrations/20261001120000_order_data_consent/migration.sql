-- Prueba de la autorización de tratamiento de datos (Ley 1581) en cada pedido
ALTER TABLE "StoreOrder" ADD COLUMN "dataConsentAt" TIMESTAMP(3);
