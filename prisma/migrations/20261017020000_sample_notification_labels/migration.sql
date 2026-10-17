-- Etiquetas de los avisos de muestras en femenino (creadoras), 2026-10-17.
-- Solo si siguen con el texto de fábrica.
UPDATE "NotificationTypeConfig" SET "label" = 'Una creadora solicitó una muestra' WHERE "key" = 'SAMPLE_REQUESTED' AND "label" = 'Creador solicitó una muestra';
UPDATE "NotificationTypeConfig" SET "label" = 'Una creadora aceptó tu oferta de muestra' WHERE "key" = 'SAMPLE_OFFER_ACCEPTED' AND "label" = 'Creador aceptó tu oferta de muestra';
