-- Menú lateral (hamburguesa) en celular para las tiendas con menús largos
-- (2026-10-18). El tema guarda la configuración completa, así que el
-- nuevo valor por defecto del esquema no alcanza a las marcas que ya
-- tenían tema; acá pasan al lateral las que tienen 5 o más entradas de
-- menú y seguían con la fila deslizable. Ver brand-theme.ts.
UPDATE "BrandTheme" t
SET
  "draftConfig" = jsonb_set(t."draftConfig"::jsonb, '{header,mobile,menuStyle}', '"hamburger"'),
  "publishedConfig" = CASE
    WHEN t."publishedConfig" IS NOT NULL AND (t."publishedConfig"::jsonb #>> '{header,mobile,menuStyle}') = 'below'
      THEN jsonb_set(t."publishedConfig"::jsonb, '{header,mobile,menuStyle}', '"hamburger"')
    ELSE t."publishedConfig"
  END
WHERE (t."draftConfig"::jsonb #>> '{header,mobile,menuStyle}') = 'below'
  AND (SELECT COUNT(*) FROM "StorefrontMenuItem" m WHERE m."brandId" = t."brandId") >= 5;
