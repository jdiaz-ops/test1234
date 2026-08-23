-- Las marcas que ya estaban APPROVED antes de este cambio no deberían
-- desaparecer del marketplace solo porque se agregó el paso "Cómo te
-- cobramos" al onboarding (que ahora es, junto con no estar bloqueada, uno
-- de los requisitos de visibilidad — ver marketplace-service.ts). Se
-- consideran "ya al tanto" del cobro y quedan con billingAcknowledgedAt
-- puesto — sin esto, cualquier marca aprobada y visible antes de este
-- deploy se ocultaría de golpe hasta que alguien entre a la plataforma y
-- confirme el paso a mano.
UPDATE "BrandProfile"
SET "billingAcknowledgedAt" = now()
WHERE status = 'APPROVED' AND "billingAcknowledgedAt" IS NULL;
