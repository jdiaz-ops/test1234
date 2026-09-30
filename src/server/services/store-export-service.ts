import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { orderNumber } from "@/lib/order-math";

/// Exportaciones a Excel (.xlsx) de "Mi tienda" — productos y pedidos,
/// para contabilidad o respaldo propio de la marca. Los valores de dinero
/// van como números con formato de pesos (se pueden sumar en Excel), las
/// fechas como fechas. Ver conversación del 2026-09-30.

const MONEY_FORMAT = '"$"#,##0';
const DATE_FORMAT = "dd/mm/yyyy hh:mm";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  DRAFT: "Oculto",
  UNLISTED: "No listado",
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  EXPIRED: "Vencido",
  REFUNDED: "Devuelto",
};
const FULFILLMENT_LABEL: Record<string, string> = {
  UNFULFILLED: "Sin preparar",
  PREPARED: "Preparado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
};
const TYPE_LABEL: Record<string, string> = { PHYSICAL: "Físico", SERVICE: "Servicio", DIGITAL: "Digital" };

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/// Una fila por producto; los productos con variantes llevan además una
/// fila por variante (con la columna Variante llena), que es donde vive
/// su precio e inventario real.
export async function buildProductsWorkbook(brandId: string): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true },
    orderBy: { name: "asc" },
    include: {
      variants: { orderBy: { position: "asc" } },
      brandCollections: { include: { collection: { select: { name: true } } } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Marcolini";
  const sheet = wb.addWorksheet("Productos");
  sheet.columns = [
    { header: "Nombre", key: "name", width: 40 },
    { header: "Variante", key: "variant", width: 24 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Tipo", key: "type", width: 10 },
    { header: "Precio", key: "price", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Precio antes", key: "compareAt", width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: "Inventario", key: "stock", width: 12 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Código de barras", key: "barcode", width: 18 },
    { header: "Colecciones", key: "collections", width: 30 },
    { header: "Dirección (URL)", key: "slug", width: 36 },
  ];

  for (const p of products) {
    const collections = p.brandCollections.map((c) => c.collection.name).join(", ");
    sheet.addRow({
      name: p.name,
      variant: p.hasVariants ? `${p.variants.length} variantes` : "",
      status: STATUS_LABEL[p.status] ?? p.status,
      type: TYPE_LABEL[p.type] ?? p.type,
      price: p.hasVariants ? null : Number(p.price),
      compareAt: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
      stock: p.hasVariants ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      collections,
      slug: p.slug ?? "",
    });
    for (const v of p.variants) {
      sheet.addRow({
        name: p.name,
        variant: [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(" / "),
        status: STATUS_LABEL[p.status] ?? p.status,
        type: TYPE_LABEL[p.type] ?? p.type,
        price: v.price != null ? Number(v.price) : Number(p.price),
        compareAt: null,
        stock: v.stock,
        sku: v.sku ?? "",
        barcode: v.barcode ?? "",
        collections,
        slug: p.slug ?? "",
      });
    }
  }
  styleHeader(sheet);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/// Una fila por pedido (sin los pendientes/fallidos/vencidos, que no son
/// ventas), con los productos resumidos en una celda.
export async function buildOrdersWorkbook(brandId: string): Promise<Buffer> {
  const orders = await prisma.storeOrder.findMany({
    where: { brandId, kind: "PURCHASE", status: { in: ["PAID", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Marcolini";
  const sheet = wb.addWorksheet("Pedidos");
  sheet.columns = [
    { header: "Pedido", key: "number", width: 12 },
    { header: "Fecha de pago", key: "paidAt", width: 18, style: { numFmt: DATE_FORMAT } },
    { header: "Estado", key: "status", width: 11 },
    { header: "Envío", key: "fulfillment", width: 13 },
    { header: "Cliente", key: "buyer", width: 26 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Dirección", key: "address", width: 34 },
    { header: "Ciudad", key: "city", width: 16 },
    { header: "Departamento", key: "region", width: 16 },
    { header: "Productos", key: "items", width: 50 },
    { header: "Unidades", key: "units", width: 10 },
    { header: "Subtotal", key: "subtotal", width: 13, style: { numFmt: MONEY_FORMAT } },
    { header: "Descuento", key: "discount", width: 13, style: { numFmt: MONEY_FORMAT } },
    { header: "Código de creador", key: "code", width: 16 },
    { header: "Costo de envío", key: "shipping", width: 13, style: { numFmt: MONEY_FORMAT } },
    { header: "Total", key: "total", width: 13, style: { numFmt: MONEY_FORMAT } },
    { header: "IVA incluido", key: "tax", width: 13, style: { numFmt: MONEY_FORMAT } },
    { header: "Transportadora", key: "carrier", width: 16 },
    { header: "Guía", key: "tracking", width: 18 },
    { header: "Fecha de devolución", key: "refundedAt", width: 18, style: { numFmt: DATE_FORMAT } },
  ];

  for (const o of orders) {
    sheet.addRow({
      number: orderNumber(o.reference),
      paidAt: o.paidAt ?? o.createdAt,
      status: ORDER_STATUS_LABEL[o.status] ?? o.status,
      fulfillment: o.shippingAddress ? (FULFILLMENT_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus) : "",
      buyer: o.buyerName,
      email: o.buyerEmail,
      phone: o.buyerPhone,
      address: o.shippingAddress ?? "",
      city: o.shippingCity ?? "",
      region: o.shippingRegion ?? "",
      items: o.items
        .map((i) => `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`)
        .join("; "),
      units: o.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: o.subtotalCents / 100,
      discount: o.discountCents / 100,
      code: o.discountCode ?? "",
      shipping: o.shippingCents / 100,
      total: o.totalCents / 100,
      tax: o.taxCents / 100,
      carrier: o.carrier ?? "",
      tracking: o.trackingNumber ?? "",
      refundedAt: o.refundedAt ?? null,
    });
  }
  styleHeader(sheet);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
