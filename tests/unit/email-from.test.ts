import { afterAll, describe, expect, it, vi } from "vitest";

// Con Resend "configurado" (de mentira), para ver el remitente de cada correo.
const env = vi.hoisted(() => {
  const before = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = "re_prueba";
  process.env.EMAIL_FROM = "Marcolini <no-reply@marcolini.lat>";
  return { before, sent: [] as { from: string; to: string; subject: string }[] };
});
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: { from: string; to: string; subject: string }) => {
        env.sent.push(message);
        return { data: { id: "id-prueba" }, error: null };
      },
    };
  },
}));

import { fromWithName, sendNewOrderBrandEmail, sendOrderShippedEmail, type OrderEmailData } from "@/lib/email";

afterAll(() => {
  if (env.before.key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = env.before.key;
  if (env.before.from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = env.before.from;
});

const ORDER: OrderEmailData = {
  orderNumber: "A1B2C3D4",
  brandName: "H la Cosedora",
  brandLogoUrl: null,
  buyerName: "Ana María Gómez",
  buyerEmail: "ana@ejemplo.com",
  buyerPhone: "3001234567",
  items: [{ name: "Esmalte Chicago", variantLabel: null, quantity: 1, unitPriceCents: 400000 }],
  subtotalCents: 400000,
  discountCents: 0,
  discountCode: null,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 400000,
  shippingAddress: "Calle 1 # 2-3",
  shippingCity: "Bogotá",
  shippingRegion: "Bogotá D.C.",
  shippingNotes: null,
};

describe("remitente de los correos", () => {
  it("el nombre de la marca con la dirección de siempre", () => {
    expect(fromWithName("H la Cosedora", "Marcolini <no-reply@marcolini.lat>")).toBe('"H la Cosedora" <no-reply@marcolini.lat>');
    expect(fromWithName('Peñón "Uñas"\r\nBcc: x@y.z', "no-reply@marcolini.lat")).toBe('"Peñón Uñas Bcc: x@y.z" <no-reply@marcolini.lat>');
    expect(fromWithName("  ", "Marcolini <no-reply@marcolini.lat>")).toBe("Marcolini <no-reply@marcolini.lat>");
  });

  it("a quien compra le llega de la marca; a la marca, de Marcolini", async () => {
    await sendOrderShippedEmail(ORDER, { carrier: "Interrapidísimo", trackingNumber: "240012345678", trackingUrl: null }, null);
    await sendNewOrderBrandEmail("marca@ejemplo.com", ORDER, "https://marcolini.lat/marca/tienda/pedidos/x");
    expect(env.sent.map((m) => [m.to, m.from])).toEqual([
      ["ana@ejemplo.com", '"H la Cosedora" <no-reply@marcolini.lat>'],
      ["marca@ejemplo.com", "Marcolini <no-reply@marcolini.lat>"],
    ]);
  });
});
