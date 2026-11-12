-- Facturas de Dataico guardadas en el pedido equivocado. Con un número ya
-- usado, Dataico no da error: devuelve la factura que ya existe, y Marcolini
-- la guardaba como la de este pedido. El 2026-11-09 un pedido de H la
-- Cosedora quedó con la FE13744, que es de otra compra del 4 de octubre
-- (ver firstFreeNumber en src/server/services/dataico-service.ts).
-- Esos pedidos vuelven a quedar sin factura, con el aviso y «Reintentar»
-- en el detalle del pedido. El cron no los toma solos (einvoiceAttempts al
-- máximo): primero se revisa el siguiente número en Conexiones.
UPDATE "StoreOrder" AS o
SET "einvoiceStatus" = 'FAILED',
    "einvoiceError" = 'La factura ' || COALESCE(o."einvoiceNumber", '') || ' que aparecía era de otra compra: Dataico la devolvió porque ese número ya estaba usado. Revisa el siguiente número en Conexiones y toca «Reintentar».',
    "einvoiceUuid" = NULL,
    "einvoiceNumber" = NULL,
    "einvoiceCufe" = NULL,
    "einvoicePdfUrl" = NULL,
    "einvoiceIssuedAt" = NULL,
    "einvoiceAttempts" = 6
WHERE o."einvoiceStatus" = 'ISSUED'
  AND (
    (o."id" = 'cmwa10zac0001l508ex8fvztk' AND o."einvoiceNumber" = 'FE13744')
    -- Dos pedidos con la misma factura: se queda con ella el primero.
    OR EXISTS (
      SELECT 1
      FROM "StoreOrder" AS p
      WHERE p."id" <> o."id"
        AND p."einvoiceStatus" = 'ISSUED'
        AND (
          (o."einvoiceUuid" IS NOT NULL AND p."einvoiceUuid" = o."einvoiceUuid")
          OR (o."einvoiceCufe" IS NOT NULL AND p."einvoiceCufe" = o."einvoiceCufe")
        )
        AND (p."einvoiceIssuedAt" < o."einvoiceIssuedAt" OR (p."einvoiceIssuedAt" = o."einvoiceIssuedAt" AND p."id" < o."id"))
    )
  );
