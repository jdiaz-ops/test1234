import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { formatDateTimeCo } from "@/lib/date-time-co";

/// Hoja de empaque: lo que va en cada caja, para el equipo que empaca sin
/// entrar a la plataforma (pedido de H la Cosedora del 2026-11-27). Varios
/// pedidos por hoja para no gastar papel; en cada uno, el número de guía
/// (para saber a qué paquete va) y cada producto con su cantidad bien
/// visible: el error más común es empacar 1 cuando eran varias unidades.

export class PackingSlipError extends Error {}

/// Pedidos por PDF.
export const MAX_PACKING_ORDERS = 100;

export type SlipItem = { quantity: number; name: string; sku: string | null };

export type SlipOrder = {
  number: string;
  buyerName: string;
  place: string;
  notes: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  items: SlipItem[];
};

/// Una línea por producto, por nombre: si el mismo aparece dos veces en
/// el pedido, va una sola vez con las cantidades sumadas.
export function slipItems(
  items: { quantity: number; name: string; variantLabel: string | null; sku: string | null }[],
): SlipItem[] {
  const merged = new Map<string, SlipItem>();
  for (const item of items) {
    const name = item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name;
    const key = `${item.sku ?? ""}|${name.trim().toLowerCase()}`;
    const found = merged.get(key);
    if (found) found.quantity += item.quantity;
    else merged.set(key, { quantity: item.quantity, name: name.trim(), sku: item.sku?.trim() || null });
  }
  // "Tono 2" antes que "Tono 10".
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
}

/// Los caracteres que no caben en las fuentes del PDF (emojis, otros
/// alfabetos) se quitan; tildes y eñes sí quedan.
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
  0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function pdfText(text: string | null | undefined): string {
  return [...(text ?? "").normalize("NFC")]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(code)) return ch;
      return /\s/.test(ch) ? " " : "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// Hoja carta, en puntos.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT = PAGE_WIDTH - 2 * MARGIN;
const INK = rgb(0.07, 0.07, 0.07);
const SOFT = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.75, 0.75, 0.75);
const WHITE = rgb(1, 1, 1);

/// Corta el texto en renglones que caben en `width` (máximo `max`).
function wrap(text: string, font: PDFFont, size: number, width: number, max = 2): string[] {
  const fits = (t: string) => font.widthOfTextAtSize(t, size) <= width;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (!fits(line) && line.length > 1) {
      // Una palabra más larga que el renglón: se parte.
      let cut = line.length - 1;
      while (cut > 1 && !fits(line.slice(0, cut))) cut -= 1;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
  kept[max - 1] = `${last}…`;
  return kept;
}

function fit(text: string, font: PDFFont, size: number, width: number) {
  return wrap(text, font, size, width, 1)[0] ?? "";
}

export async function buildPackingSlipsPdf(brandName: string, orders: SlipOrder[], now: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const brand = pdfText(brandName);
  const totalUnits = orders.reduce((sum, o) => sum + o.items.reduce((n, i) => n + i.quantity, 0), 0);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  // y = la parte de arriba de lo que falta por dibujar.
  let y = PAGE_HEIGHT - MARGIN;
  const text = (t: string, x: number, top: number, font: PDFFont, size: number, color = INK) =>
    page.drawText(t, { x, y: top - size, font, size, color });

  // Encabezado de la primera hoja.
  text(`Hoja de empaque${brand ? ` · ${brand}` : ""}`, MARGIN, y, bold, 16);
  y -= 22;
  text(
    pdfText(`${formatDateTimeCo(now)} · ${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} · ${totalUnits} unidades`),
    MARGIN,
    y,
    regular,
    10,
    SOFT,
  );
  y -= 24;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    text(`Hoja de empaque${brand ? ` · ${brand}` : ""}`, MARGIN, y, regular, 9, SOFT);
    y -= 20;
  };
  const room = () => y - MARGIN - 20; // lo que queda antes del pie de página

  const QTY_X = MARGIN + 18;
  const QTY_W = 34;
  const NAME_X = QTY_X + QTY_W + 10;
  const ITEM_SIZE = 11;

  const itemLayout = (item: SlipItem) => {
    const sku = item.sku ? pdfText(item.sku) : "";
    const skuWidth = sku ? Math.min(mono.widthOfTextAtSize(sku, 9), 120) : 0;
    const nameWidth = PAGE_WIDTH - MARGIN - NAME_X - (skuWidth ? skuWidth + 12 : 0);
    const lines = wrap(pdfText(item.name), regular, ITEM_SIZE, nameWidth);
    return { sku, skuWidth, lines, height: Math.max(22, 8 + lines.length * 13) };
  };
  const HEADER = 19 + 14 + 4;
  const NOTE = 13;
  const TOTAL = 24;
  const SEPARATOR = 16;

  orders.forEach((order, index) => {
    const layouts = order.items.map(itemLayout);
    const blockHeight =
      HEADER + (order.notes ? NOTE : 0) + layouts.reduce((sum, l) => sum + l.height, 0) + TOTAL + SEPARATOR;
    const header = (continued: boolean) => {
      const number = `Pedido #${pdfText(order.number)}${continued ? " (continúa)" : ""}`;
      text(number, MARGIN, y, bold, 14);
      const guide = order.trackingNumber
        ? pdfText(`Guía ${order.trackingNumber}${order.carrier ? ` · ${order.carrier}` : ""}`)
        : "Sin guía todavía";
      const guideFont = order.trackingNumber ? bold : regular;
      const guideWidth = Math.min(guideFont.widthOfTextAtSize(guide, 12), CONTENT - bold.widthOfTextAtSize(number, 14) - 16);
      text(fit(guide, guideFont, 12, guideWidth), PAGE_WIDTH - MARGIN - guideWidth, y + 1, guideFont, 12, order.trackingNumber ? INK : SOFT);
      y -= 19;
      if (!continued) {
        text(fit(pdfText(`${order.buyerName} · ${order.place}`), regular, 10, CONTENT), MARGIN, y, regular, 10, SOFT);
        y -= 14;
        if (order.notes) {
          text(fit(pdfText(`Nota: ${order.notes}`), regular, 9, CONTENT), MARGIN, y, regular, 9, SOFT);
          y -= 13;
        }
      }
      y -= 4;
    };

    // Cada pedido entero en una hoja: si no cabe en lo que queda, va en
    // la siguiente. Uno más largo que una hoja empieza en hoja nueva y
    // sigue en la otra.
    const fresh = y >= PAGE_HEIGHT - MARGIN - 50;
    if (!fresh && blockHeight > room() + SEPARATOR) newPage();
    header(false);

    order.items.forEach((item, itemIndex) => {
      const { sku, skuWidth, lines, height: rowHeight } = layouts[itemIndex];
      if (room() < rowHeight) {
        newPage();
        header(true);
      }
      const top = y;
      // Casilla para chulear.
      page.drawRectangle({ x: MARGIN, y: top - 14, width: 10, height: 10, borderColor: INK, borderWidth: 0.8 });
      // Cantidad: en negro cuando son varias unidades, para que no se pase.
      const many = item.quantity > 1;
      page.drawRectangle({
        x: QTY_X,
        y: top - 17,
        width: QTY_W,
        height: 17,
        color: many ? INK : WHITE,
        borderColor: INK,
        borderWidth: 1,
      });
      const qty = String(item.quantity);
      page.drawText(qty, {
        x: QTY_X + (QTY_W - bold.widthOfTextAtSize(qty, 12)) / 2,
        y: top - 13.5,
        font: bold,
        size: 12,
        color: many ? WHITE : INK,
      });
      lines.forEach((line, i) => text(line, NAME_X, top - 3 - i * 13, many ? bold : regular, ITEM_SIZE));
      if (sku) text(fit(sku, mono, 9, skuWidth), PAGE_WIDTH - MARGIN - skuWidth, top - 4, mono, 9, SOFT);
      y -= rowHeight;
    });

    const units = order.items.reduce((n, i) => n + i.quantity, 0);
    if (room() < TOTAL) {
      // El total nunca queda solo en una hoja, sin saber de qué pedido es.
      newPage();
      header(true);
    }
    const total = `Total: ${units} ${units === 1 ? "unidad" : "unidades"} · ${order.items.length} ${order.items.length === 1 ? "producto" : "productos"}`;
    text(total, MARGIN, y - 2, bold, 11);
    y -= TOTAL;
    if (index < orders.length - 1) {
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.8,
        color: RULE,
        dashArray: [4, 3],
      });
      y -= SEPARATOR;
    }
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(label, {
      x: (PAGE_WIDTH - regular.widthOfTextAtSize(label, 9)) / 2,
      y: MARGIN - 18,
      font: regular,
      size: 9,
      color: SOFT,
    });
  });
  return doc.save();
}

/// La hoja de empaque de esos pedidos de la marca, en el orden pedido (el
/// mismo de la lista, como el PDF de las guías).
export async function packingSlipsPdf(brandId: string, orderIds: string[]) {
  const ids = orderIds.slice(0, MAX_PACKING_ORDERS);
  const [brand, orders] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { id: brandId }, select: { companyName: true } }),
    prisma.storeOrder.findMany({
      where: { brandId, id: { in: ids } },
      select: {
        id: true,
        reference: true,
        buyerName: true,
        shippingCity: true,
        shippingRegion: true,
        shippingNotes: true,
        carrier: true,
        trackingNumber: true,
        items: {
          select: {
            quantity: true,
            name: true,
            variantLabel: true,
            product: { select: { sku: true } },
            variant: { select: { sku: true } },
          },
        },
      },
    }),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const slips: SlipOrder[] = ids.flatMap((id) => {
    const o = byId.get(id);
    if (!o) return [];
    return [
      {
        number: o.reference.slice(-8).toUpperCase(),
        buyerName: o.buyerName,
        place: [o.shippingCity, o.shippingRegion].filter(Boolean).join(", "),
        notes: o.shippingNotes,
        carrier: o.carrier,
        trackingNumber: o.trackingNumber,
        items: slipItems(
          o.items.map((i) => ({
            quantity: i.quantity,
            name: i.name,
            variantLabel: i.variantLabel,
            sku: i.variant?.sku ?? i.product?.sku ?? null,
          })),
        ),
      },
    ];
  });
  if (slips.length === 0) throw new PackingSlipError("Elige pedidos de tu tienda.");
  return buildPackingSlipsPdf(brand?.companyName ?? "", slips, new Date());
}
