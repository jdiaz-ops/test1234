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
   `nailfest:LA_LLAVE` (varias creadoras: separadas por coma). Marcada para
   Production. Redeploy. Se perdonan comillas alrededor y un espacio después
   de los dos puntos.
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
(demasiadas llamadas, con `Retry-After`). El `401` trae `reason`:
`no_keys` = Marcolini no tiene ninguna llave bien escrita en
`CATALOG_API_KEYS` (el problema está de este lado); `missing_key` = no llegó
ninguna llave (ojo: `fetch` suelta el encabezado `Authorization` si lo
redirigen a otro dominio, por ejemplo de marcolini.lat a www.marcolini.lat —
hay que llamar a la dirección final o seguir la redirección a mano);
`mismatch` = llegó una que no coincide (revisar la del otro sitio). También
trae `keyLengths`, el largo de las llaves de acá.

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

### Datos para clasificar y filtrar (agregados el 2026-10-20)

Por marca:

- `freeShippingFrom`: desde qué subtotal envía gratis según las zonas de envío
  de su tienda en Marcolini (`0` = siempre); `null` si no ofrece o no se sabe
  (Shopify/WooCommerce). `freeShippingAllZones`: si vale en todas sus zonas (si
  no, es el menor monto, solo en algunas).

Por producto:

- `description`: texto plano de hasta 300 caracteres.
- `attributes`: los atributos tal cual (`Familia de color`, `Tono`, `Tamaño`,
  `Grupo`…). `colorFamily`: una de las familias de color fijas de Marcolini
  (la pone la IA mirando la foto) o `null`.
- `nicheCategory`: la categoría del nicho con las mismas reglas con que
  Marcolini propone colecciones (`Esmaltes`, `Gel de construcción`,
  `Acrílico`, `Soft gel y tips`, `Decoración`, `Stamping`,
  `Herramientas y equipos`, `Preparación y cuidado`, `Kits y combos`).
- `line` / `variant` / `size`: la línea del producto y qué es dentro de ella
  ("Gel Polish Rosados" / "Princesa" / "15 ml"), del atributo `Grupo`, de la
  familia que se detecta por el nombre o de "Línea – Referencia".
- `variantCount` / `optionNames`: cuando el producto mismo tiene variantes.
- `rating`: `{ average, count }` de las reseñas aprobadas, o `null`.
- `unitsLeft`: unidades que quedan, solo si la tienda controla inventario.
- `soldWithCode`: unidades vendidas con el código de la creadora en los
  últimos 90 días (pedidos pagados en la tienda de Marcolini).

Código: `src/app/api/v1/catalogo/route.ts`,
`src/server/services/creator-catalog-api-service.ts` y
`src/lib/creator-api-keys.ts`.
