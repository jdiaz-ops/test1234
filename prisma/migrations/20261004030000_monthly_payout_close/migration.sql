-- Cierre por mes en el pago a creadoras (aprobado por Juan el 2026-10-04):
-- lo que se vende en un mes se paga el día de pago del mes siguiente. Ver
-- src/lib/payout-calendar.ts, que hace la misma cuenta para las ventas
-- nuevas.

-- 1) Las comisiones que siguen en espera pasan al nuevo calendario. Día de
--    la venta en hora de Colombia (UTC-5); pago = día de pago del mes
--    siguiente, o el del otro mes si la venta no alcanza los días de espera
--    por devoluciones. holdUntil queda a las 00:00 de Colombia (05:00 UTC)
--    de ese día.
WITH cfg AS (
  SELECT "payoutDayOfMonth" AS pay_day, "refundHoldDays" AS hold_days
  FROM "PlatformConfig" WHERE "id" = 'singleton'
),
sale AS (
  SELECT c."id",
         (t."occurredAt" - INTERVAL '5 hours')::date AS sale_day,
         (date_trunc('month', (t."occurredAt" - INTERVAL '5 hours')::date) + INTERVAL '1 month')::date AS next_month
  FROM "Commission" c
  JOIN "Transaction" t ON t."id" = c."transactionId"
  WHERE c."status" = 'PENDING'
),
payout AS (
  SELECT sale."id",
         CASE
           WHEN sale.sale_day + cfg.hold_days
                > LEAST(sale.next_month + (cfg.pay_day - 1), (sale.next_month + INTERVAL '1 month - 1 day')::date)
           THEN LEAST(
                  (sale.next_month + INTERVAL '1 month')::date + (cfg.pay_day - 1),
                  (sale.next_month + INTERVAL '2 months - 1 day')::date
                )
           ELSE LEAST(sale.next_month + (cfg.pay_day - 1), (sale.next_month + INTERVAL '1 month - 1 day')::date)
         END AS pay_date
  FROM sale CROSS JOIN cfg
)
UPDATE "Commission" c
SET "holdUntil" = payout.pay_date + INTERVAL '5 hours'
FROM payout
WHERE c."id" = payout."id";

-- 2) El aviso de cada venta dice cuándo se paga. Solo si el texto sigue
--    siendo el de fábrica (si el admin lo editó, se respeta).
UPDATE "NotificationTypeConfig"
SET "messageTemplate" = '¡Vendiste con tu código en {marca}! Ganaste {monto} de comisión. Se te paga el {fecha_pago}, junto con tus demás ventas de {mes}.',
    "placeholders" = 'marca,monto,fecha_pago,mes'
WHERE "key" = 'SALE_COMMISSION'
  AND "messageTemplate" = '¡Vendiste con tu código en {marca}! Ganaste {monto} de comisión.';
