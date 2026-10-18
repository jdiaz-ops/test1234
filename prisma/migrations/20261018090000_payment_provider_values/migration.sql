-- Pasarelas nuevas (cada marca cobra con su propia cuenta). Van en su
-- propia migración: Postgres no deja usar un valor nuevo de un enum en la
-- misma transacción que lo agrega.
ALTER TYPE "PaymentProvider" ADD VALUE 'MERCADO_PAGO';
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYU';
ALTER TYPE "PaymentProvider" ADD VALUE 'EPAYCO';
ALTER TYPE "PaymentProvider" ADD VALUE 'BOLD';
