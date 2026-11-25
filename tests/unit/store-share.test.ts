import { describe, expect, it } from "vitest";
import { storeDescription, storeShare } from "@/lib/store-share";

const LOGO = "https://x.public.blob.vercel-storage.com/logo.png";
const brand = { companyName: "H La Cosedora Nail Art", description: "Esmaltes y placas de stamping.", logoUrl: LOGO };

describe("lo que se ve al compartir un link de la tienda (y en los anuncios)", () => {
  it("sin datos propios de la página, va la marca: su nombre, su descripción y su logo", () => {
    expect(storeShare(brand)).toEqual({
      title: "H La Cosedora Nail Art",
      description: "Esmaltes y placas de stamping.",
      siteName: "H La Cosedora Nail Art",
      locale: "es_CO",
      type: "website",
      images: [{ url: LOGO }],
    });
  });

  it("la página pone su título, su texto y su foto; sin descripción de la marca, una frase con su nombre", () => {
    expect(
      storeShare({ ...brand, description: "  " }, { title: "Outlet — H La Cosedora Nail Art", description: null, image: "https://x/outlet.jpg" }),
    ).toMatchObject({
      title: "Outlet — H La Cosedora Nail Art",
      description: "Compra directo con H La Cosedora Nail Art.",
      images: [{ url: "https://x/outlet.jpg" }],
    });
    expect(storeDescription({ companyName: "Bella", description: null })).toBe("Compra directo con Bella.");
    // Sin foto ni logo: sin imagen, en vez de una que no es de la marca.
    expect(storeShare({ ...brand, logoUrl: null })).not.toHaveProperty("images");
  });

  it("corta el texto largo en una palabra, en un solo renglón", () => {
    const clean = `Esmaltes ${"tradicionales y en gel ".repeat(20)}`.trim();
    const description = String(storeShare(brand, { description: clean.replaceAll(" ", "\n ") }).description);
    expect(description.length).toBeLessThanOrEqual(201);
    expect(description.endsWith("…")).toBe(true);
    const cut = description.slice(0, -1);
    expect(clean.startsWith(cut)).toBe(true);
    expect(clean[cut.length]).toBe(" ");
  });
});
