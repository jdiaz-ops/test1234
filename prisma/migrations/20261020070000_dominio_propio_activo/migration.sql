-- Dominio propio: verificar el TXT prueba que es de la marca, pero los
-- links, correos, pagos y el mapa del sitio solo pasan al dominio cuando de
-- verdad abre la tienda por https (customDomainActiveAt, ver
-- custom-domain-service.ts). Pedido del 2026-10-19: "que no se rompa
-- ninguna URL".
ALTER TABLE "BrandProfile" ADD COLUMN     "customDomainActiveAt" TIMESTAMP(3),
ADD COLUMN     "customDomainCheckedAt" TIMESTAMP(3);

-- Los dominios que ya estaban verificados siguen como hasta hoy (sus links
-- ya usaban el dominio propio). La revisión diaria (/api/cron/dominios) los
-- devuelve al subdominio si no responden.
UPDATE "BrandProfile" SET "customDomainActiveAt" = "customDomainVerifiedAt"
WHERE "customDomain" IS NOT NULL AND "customDomainVerifiedAt" IS NOT NULL;

-- Avisos (Admin → Notificaciones → Configuración, ver notification-types.ts).
INSERT INTO "NotificationTypeConfig" ("id", "key", "label", "audience", "channelEmail", "messageTemplate", "placeholders", "updatedAt") VALUES
('customdomainactive', 'CUSTOM_DOMAIN_ACTIVE', 'Tu dominio propio quedó activo', 'BRAND', true, '¡Tu dominio {dominio} ya está activo! Tu tienda abre ahí y los links de {subdominio} llevan a la misma página en tu dominio.', 'dominio,subdominio', CURRENT_TIMESTAMP),
('customdomaindown', 'CUSTOM_DOMAIN_DOWN', 'Tu dominio propio dejó de responder', 'BRAND', true, 'Tu dominio {dominio} dejó de abrir tu tienda. Mientras lo revisas, todo sigue funcionando en {subdominio}. Revisa el DNS en Configuración → General → Dominio propio.', 'dominio,subdominio', CURRENT_TIMESTAMP),
('customdomainadmin', 'CUSTOM_DOMAIN_ADMIN', 'Un dominio propio necesita un paso en Vercel', 'ADMIN', true, '{marca} verificó su dominio {dominio}. {detalle}', 'marca,dominio,detalle', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
