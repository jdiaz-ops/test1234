import { describe, expect, it } from "vitest";
import { orderNumber, orderTotal, stockMovements, taxIncluded } from "@/lib/order-math";

describe("IVA incluido en el precio", () => {
  it("saca la parte del precio que es impuesto, sin sumarla", () => {
    expect(taxIncluded(11900, 19)).toBe(1900);
    expect(taxIncluded(4000, 19)).toBe(639);
    expect(taxIncluded(15000, 19)).toBe(2395);
  });

  it("devuelve 0 sin tasa o sin monto", () => {
    expect(taxIncluded(15000, 0)).toBe(0);
    expect(taxIncluded(0, 19)).toBe(0);
    expect(taxIncluded(-100, 19)).toBe(0);
  });

  it("funciona igual en centavos", () => {
    expect(taxIncluded(1_190_000, 19)).toBe(190_000);
  });
});

describe("total del pedido", () => {
  it("es subtotal menos descuento más envío, sin sumar IVA", () => {
    // Caso real reportado: $45.000 + IVA 10% se cobraba $49.500.
    expect(orderTotal({ subtotal: 45000, discount: 0, shipping: 0 })).toBe(45000);
    expect(orderTotal({ subtotal: 45000, discount: 4500, shipping: 12000 })).toBe(52500);
  });

  it("nunca da negativo si el descuento supera el subtotal", () => {
    expect(orderTotal({ subtotal: 10000, discount: 15000, shipping: 8000 })).toBe(8000);
  });

  it("toma el envío en la misma unidad que el subtotal", () => {
    // Error real anterior: el envío en centavos se sumaba como pesos (100x).
    expect(orderTotal({ subtotal: 4_500_000, discount: 0, shipping: 1_200_000 })).toBe(5_700_000);
  });
});

describe("movimientos de inventario", () => {
  it("suma líneas del mismo producto y variante", () => {
    const moves = stockMovements([
      { productId: "a", variantId: null, quantity: 2 },
      { productId: "a", variantId: null, quantity: 1 },
      { productId: "b", variantId: "b-rojo", quantity: 1 },
      { productId: "b", variantId: "b-azul", quantity: 4 },
    ]);
    expect(moves).toEqual([
      { productId: "a", variantId: null, quantity: 3 },
      { productId: "b", variantId: "b-rojo", quantity: 1 },
      { productId: "b", variantId: "b-azul", quantity: 4 },
    ]);
  });

  it("ignora líneas de productos borrados o sin cantidad", () => {
    expect(
      stockMovements([
        { productId: null, variantId: null, quantity: 3 },
        { productId: "a", variantId: null, quantity: 0 },
      ]),
    ).toEqual([]);
  });
});

it("número de pedido corto en mayúsculas", () => {
  expect(orderNumber("mt_1234abcd-5678-90ef-abcd-ef12345678ab")).toBe("345678AB");
});

describe("inventario disponible", () => {
  it("resta lo apartado por pedidos sin pagar, sin bajar de cero", async () => {
    const { availableStock } = await import("@/lib/order-math");
    expect(availableStock(10, 3)).toBe(7);
    expect(availableStock(1, 1)).toBe(0);
    expect(availableStock(1, 4)).toBe(0);
    expect(availableStock(null, 4)).toBeNull();
  });
});
