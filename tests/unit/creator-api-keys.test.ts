import { describe, expect, it } from "vitest";
import { bearerToken, matchCatalogApiKey, parseCatalogApiKeys } from "@/lib/creator-api-keys";

const KEY_A = "a".repeat(32);
const KEY_B = "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0";

describe("llaves de la API de catálogo", () => {
  it("lee entradas slug:llave separadas por coma o salto de línea", () => {
    expect(parseCatalogApiKeys(`NailFest:${KEY_A},\n otra:${KEY_B}`)).toEqual([
      { slug: "nailfest", key: KEY_A },
      { slug: "otra", key: KEY_B },
    ]);
  });

  it("perdona lo que se cuela al pegar en Vercel: comillas, espacios, punto y coma", () => {
    expect(parseCatalogApiKeys(`"nailfest:${KEY_A}"`)).toEqual([{ slug: "nailfest", key: KEY_A }]);
    expect(parseCatalogApiKeys(` nailfest: ${KEY_A} `)).toEqual([{ slug: "nailfest", key: KEY_A }]);
    expect(parseCatalogApiKeys(`nailfest:'${KEY_A}'; otra:${KEY_B}`)).toEqual([
      { slug: "nailfest", key: KEY_A },
      { slug: "otra", key: KEY_B },
    ]);
  });

  it("perdona el punto de la frase, asteriscos, el slug repetido y el nombre de la variable", () => {
    const only = [{ slug: "nailfest", key: KEY_B }];
    expect(parseCatalogApiKeys(`nailfest:${KEY_B}.`)).toEqual(only);
    expect(parseCatalogApiKeys(`**nailfest:${KEY_B}**`)).toEqual(only);
    expect(parseCatalogApiKeys(`nailfest:nailfest:${KEY_B}`)).toEqual(only);
    expect(parseCatalogApiKeys(`CATALOG_API_KEYS = nailfest:${KEY_B}`)).toEqual(only);
    expect(matchCatalogApiKey(only, `${KEY_B}.`)).toBe("nailfest");
  });

  it("ignora llaves cortas o con espacios adentro, entradas sin slug y la variable vacía", () => {
    expect(parseCatalogApiKeys(`corta:abc123,:${KEY_A},sinllave,${KEY_B}`)).toEqual([]);
    expect(parseCatalogApiKeys(`nailfest:${KEY_A.slice(0, 16)} ${KEY_A.slice(16)}`)).toEqual([]);
    expect(parseCatalogApiKeys("")).toEqual([]);
    expect(parseCatalogApiKeys(undefined)).toEqual([]);
  });

  it("devuelve la creadora de la llave, o null", () => {
    const entries = parseCatalogApiKeys(`nailfest:${KEY_A},otra:${KEY_B}`);
    expect(matchCatalogApiKey(entries, KEY_B)).toBe("otra");
    expect(matchCatalogApiKey(entries, KEY_A)).toBe("nailfest");
    expect(matchCatalogApiKey(entries, `${KEY_A}x`)).toBeNull();
    expect(matchCatalogApiKey(entries, null)).toBeNull();
    expect(matchCatalogApiKey([], KEY_A)).toBeNull();
  });

  it("lee la llave del encabezado Authorization", () => {
    const req = (value?: string) => new Request("https://marcolini.lat/api/v1/catalogo", { headers: value ? { authorization: value } : {} });
    expect(bearerToken(req(`Bearer ${KEY_A}`))).toBe(KEY_A);
    expect(bearerToken(req(`bearer ${KEY_A} `))).toBe(KEY_A);
    expect(bearerToken(req(KEY_A))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});
