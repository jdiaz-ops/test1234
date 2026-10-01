-- Archivar pedidos (salen de la lista sin borrarse)
ALTER TABLE "StoreOrder" ADD COLUMN "archivedAt" TIMESTAMP(3);
