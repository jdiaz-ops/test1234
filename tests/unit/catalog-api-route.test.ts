import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La ruta solo se prueba en su respuesta 401: lo demás (el catálogo en sí)
// está en tests/integration/creator-catalog-api.test.ts.
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "1.2.3.4",
  rateLimit: async () => ({ ok: true, retryAfterSeconds: 0 }),
}));
vi.mock("@/server/services/creator-catalog-api-service", () => ({
  CreatorCatalogError: class extends Error {},
  getCreatorCatalog: async () => ({ ok: true }),
}));

const KEY = "f".repeat(40);
const call = async (key?: string) => {
  const { GET } = await import("@/app/api/v1/catalogo/route");
  return GET(new Request("https://marcolini.lat/api/v1/catalogo", { headers: key ? { authorization: `Bearer ${key}` } : {} }));
};

describe("GET /api/v1/catalogo sin llave válida", () => {
  const env = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...env };
  });

  it("avisa cuando Marcolini no tiene ninguna llave bien escrita", async () => {
    process.env.CATALOG_API_KEYS = KEY; // sin "slug:"
    const res = await call(KEY);
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe("no_keys");
  });

  it("avisa cuando la llave no coincide", async () => {
    process.env.CATALOG_API_KEYS = `nailfest:${KEY}`;
    const res = await call("e".repeat(40));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: "mismatch", keyLengths: [40] });
  });

  it("distingue cuando no llegó ninguna llave", async () => {
    process.env.CATALOG_API_KEYS = `nailfest:${KEY}`;
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe("missing_key");
  });

  it("deja pasar la llave correcta", async () => {
    process.env.CATALOG_API_KEYS = `"nailfest: ${KEY}"`;
    const res = await call(KEY);
    expect(res.status).toBe(200);
  });
});
