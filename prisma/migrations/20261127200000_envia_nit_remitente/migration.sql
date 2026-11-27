-- Envia: NIT o cédula de quien envía (las transportadoras de Colombia lo
-- exigen para crear la guía). Solo agrega una columna.

-- AlterTable
ALTER TABLE "EnviaConnection" ADD COLUMN     "originIdNumber" TEXT;

