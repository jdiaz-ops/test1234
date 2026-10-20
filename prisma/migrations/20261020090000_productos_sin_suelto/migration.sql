-- Sin "suelto" en los nombres (pedido del 2026-10-20: "quita suelto"): las
-- muestras de antes, producto por producto, ahora son solo "productos". Solo
-- cambia el nombre que sigue igual al de 20261020050000; lo que el admin ya
-- editó no se toca.
UPDATE "NotificationTypeConfig" SET "label" = 'Pedido de producto aprobado', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'SAMPLE_APPROVED' AND "label" = 'Producto suelto aprobado';
UPDATE "NotificationTypeConfig" SET "label" = 'Pedido de producto rechazado', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'SAMPLE_REJECTED' AND "label" = 'Producto suelto rechazado';
UPDATE "NotificationTypeConfig" SET "label" = 'Una marca te ofreció un producto', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'SAMPLE_OFFERED' AND "label" = 'Una marca te ofreció un producto suelto';
UPDATE "NotificationTypeConfig" SET "label" = 'Una creadora pidió un producto', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'SAMPLE_REQUESTED' AND "label" = 'Una creadora pidió un producto suelto';
UPDATE "NotificationTypeConfig" SET "label" = 'Una creadora aceptó tu producto', "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'SAMPLE_OFFER_ACCEPTED' AND "label" = 'Una creadora aceptó tu producto suelto';
