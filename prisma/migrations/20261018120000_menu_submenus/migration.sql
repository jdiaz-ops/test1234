-- Submenús en el menú de la vitrina: un ítem puede colgar de otro.
ALTER TABLE "StorefrontMenuItem" ADD COLUMN "parentId" TEXT;
CREATE INDEX "StorefrontMenuItem_parentId_idx" ON "StorefrontMenuItem"("parentId");
ALTER TABLE "StorefrontMenuItem" ADD CONSTRAINT "StorefrontMenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StorefrontMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
