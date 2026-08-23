-- Marca cuándo ya se mandó cada recordatorio (48h/24h antes del plazo del
-- corte) — para no reenviarlo cada vez que corre el cron mientras el
-- corte siga abierto.
ALTER TABLE "BrandCharge" ADD COLUMN     "reminder24SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder48SentAt" TIMESTAMP(3);
