# API de catálogo para creadoras

Una creadora con sitio propio (hoy **Nail Fest**, para su cuponera en
`nailfest.lat/cuponera`) puede leer desde su servidor el catálogo de las marcas
que la tienen vinculada, con su código y el link que le atribuye cada venta.
Es solo lectura: no crea, cambia ni borra nada en Marcolini.

## Qué entra

- **Marcas:** las que tienen a la creadora en estado ACTIVE (la aprobaron, o su
  oferta era abierta). Quedan afuera las que Marcolini mismo no está
  promoviendo: en Nivel 3 por falta de pago (sus códigos ya no atribuyen), las
  pausadas o rechazadas por el admin, y las ocultas a la fuerza. Las de prueba
  con "Mostrar siempre" sí salen.
- **Productos:** los que una compradora ve en la tienda de esas marcas —
  activos (ni borrador ni "solo con link") y con stock.
- **Descuento y comisión:** los de hoy, ya con la campaña si hay una subida
  activa (`campaign`).

## Dar acceso

1. Genera una llave larga (al menos 32 caracteres), por ejemplo con
   `openssl rand -hex 32`.
2. En Vercel → proyecto de Marcolini → Settings → Environment Variables, pon
   `CATALOG_API_KEYS` con el slug de la vitrina de la creadora y la llave:
   `nailfest:LA_LLAVE` (varias creadoras: separadas por coma). Redeploy.
3. La misma llave va en el sitio de la creadora (en Nail Fest:
   `MARCOLINI_API_KEY`).

Para quitar el acceso, borra la entrada y haz redeploy.

## Llamada

```
GET https://marcolini.lat/api/v1/catalogo?limit=500&cursor=…
Authorization: Bearer LA_LLAVE
```

- `limit`: productos por página (1 a 1000, por defecto 500).
- `cursor`: el `nextCursor` de la respuesta anterior. Sin cursor = primera
  página. Las marcas vienen completas en todas las páginas.
- Límite: 120 llamadas por minuto por llave. Con llave equivocada, 20 intentos
  cada 10 minutos por IP.

Respuestas de error: `401` (sin llave o inválida), `403` (cuenta de la creadora
suspendida), `404` (la llave apunta a una vitrina que no existe), `429`
(demasiadas llamadas, con `Retry-After`).

## Respuesta

```json
{
  "version": 1,
  "generatedAt": "2026-10-20T15:00:00.000Z",
  "creator": { "displayName": "Nail Fest", "storefrontSlug": "nailfest", "vitrinaUrl": "https://nailfest.marcolini.lat" },
  "brands": [
    {
      "id": "…",
      "name": "Marca Uno",
      "logoUrl": "https://…",
      "description": "…",
      "city": "Medellín",
      "instagramHandle": "marcauno",
      "tiktokHandle": null,
      "storeUrl": "https://marcauno.marcolini.lat/?ref=NAILFEST",
      "storeKind": "MARCOLINI",
      "codeAppliedByLink": true,
      "discountCode": "NAILFEST",
      "discountPercent": 15,
      "commissionPercent": 10,
      "campaign": null,
      "visibleInVitrina": true,
      "vitrinaOrder": 0,
      "joinedAt": "2026-10-01T12:00:00.000Z",
      "productCount": 42
    }
  ],
  "products": [
    {
      "id": "…",
      "brandId": "…",
      "name": "Gel semipermanente rojo",
      "imageUrl": "https://…",
      "images": ["https://…"],
      "price": 45000,
      "priceMax": null,
      "compareAtPrice": 52000,
      "currency": "COP",
      "url": "https://marcauno.marcolini.lat/gel-rojo?ref=NAILFEST",
      "category": null,
      "collections": ["Geles"],
      "type": "PHYSICAL",
      "featured": false,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "nextCursor": null
}
```

- `price` es el menor precio de venta (con variantes, la más barata con stock);
  `priceMax` aparece cuando las variantes cuestan distinto.
- `compareAtPrice` es el precio tachado de la tienda, solo si es mayor que
  `price`. El descuento del código (`discountPercent`) se aplica sobre `price`.
- `codeAppliedByLink`: `true` = el link ya aplica el código solo (tienda en
  Marcolini con `?ref=`, Shopify con `/discount/`); `false` = la compradora lo
  escribe al pagar.
- `campaign`: `{ name, discountPercent, commissionPercent, startsAt, endsAt }`
  mientras haya un Flash Sale activo; cada `%` es `null` si esa campaña no lo
  sube.

Código: `src/app/api/v1/catalogo/route.ts`,
`src/server/services/creator-catalog-api-service.ts` y
`src/lib/creator-api-keys.ts`.
