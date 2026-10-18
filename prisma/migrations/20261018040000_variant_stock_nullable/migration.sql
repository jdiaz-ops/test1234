-- Stock de variante nulo = sin control de inventario (2026-10-18).
ALTER TABLE "ProductVariant" ALTER COLUMN "stock" DROP NOT NULL;
