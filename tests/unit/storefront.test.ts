import { describe, expect, it } from "vitest";
import { discountPercent } from "@/components/storefront/product-card";
import { contrastTextFor, parseThemeConfig, themeToCssVars } from "@/lib/brand-theme";
import { trackingUrlFor } from "@/lib/carriers";
import { escapeHtml } from "@/lib/email";

describe("% de descuento de la tarjeta", () => {
  it("se calcula contra el precio antes", () => {
    expect(discountPercent(15000, 30000)).toBe(50);
    expect(discountPercent(6000, 9000)).toBe(33);
  });
  it("no hay oferta si el precio antes no es mayor", () => {
    expect(discountPercent(15000, 15000)).toBeNull();
    expect(discountPercent(15000, 10000)).toBeNull();
    expect(discountPercent(15000, null)).toBeNull();
  });
});

describe("tema de la tienda", () => {
  it("una tienda nueva arranca en blanco y negro con botones negros", () => {
    const theme = parseThemeConfig({});
    expect(theme.colors.fondo).toBe("#ffffff");
    expect(theme.colors.botones).toBe("#111111");
    const vars = themeToCssVars(theme);
    expect(vars["--brand-button"]).toBe("#111111");
    expect(vars["--brand-button-text"]).toBe("#ffffff");
  });

  it("un tema guardado antes del color de botones sigue funcionando", () => {
    const theme = parseThemeConfig({ colors: { principal: "#d1477b" } });
    expect(theme.colors.principal).toBe("#d1477b");
    expect(theme.colors.botones).toBe("#111111");
  });

  it("el texto del botón se elige por contraste", () => {
    expect(contrastTextFor("#000000")).toBe("#ffffff");
    expect(contrastTextFor("#ffffff")).toBe("#111111");
    expect(contrastTextFor("#f2f2f2")).toBe("#111111");
    expect(contrastTextFor("#2aaae0")).toBe("#ffffff");
    expect(contrastTextFor("#fff")).toBe("#111111");
  });
});

describe("transportadoras", () => {
  it("encuentra la página de rastreo sin importar mayúsculas", () => {
    expect(trackingUrlFor("servientrega")).toBe("https://www.servientrega.com");
    expect(trackingUrlFor("Otra empresa")).toBeNull();
    expect(trackingUrlFor(null)).toBeNull();
  });
});

it("escapa lo que escribe el comprador antes de meterlo al correo", () => {
  expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
  );
});
