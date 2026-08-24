-- Migración de datos: las campañas existentes con los tipos viejos
-- (TEMP_COMMISSION_BOOST / TEMP_DISCOUNT_BOOST, fusionados en FLASH_SALE)
-- pasan a FLASH_SALE. El JSON de config no necesita reescribirse — las
-- claves newCommissionPercent / newDiscountPercent son las mismas que ya
-- usa FLASH_SALE (ver ChallengeConfig en challenge-service.ts).
UPDATE "Challenge" SET type = 'FLASH_SALE' WHERE type = 'TEMP_COMMISSION_BOOST';
UPDATE "Challenge" SET type = 'FLASH_SALE' WHERE type = 'TEMP_DISCOUNT_BOOST';
