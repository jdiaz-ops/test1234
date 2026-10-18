-- Atributos de un producto para filtrar en la colección (tono, familia de
-- color, tamaño…): { "Tono": "Princesa", "Grupo": "Gel Polish Rosados" }.
-- Los llena "Separar variantes en productos" y sirven para los filtros de
-- la página de colección. Ver conversación del 2026-10-18.
ALTER TABLE "Product" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';
