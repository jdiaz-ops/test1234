import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// La IA de mentira: responde según el nombre de cada producto que le llega.
const create = vi.fn(async (req: { messages: { content: { type: string; text?: string; source?: { media_type: string } }[] }[] }) => {
  const blocks = req.messages[0].content;
  const names = blocks.filter((b) => b.type === "text" && b.text?.startsWith("Producto ")).map((b) => b.text!.replace(/^Producto \d+: /, ""));
  const family = (name: string) => (/pink/i.test(name) ? "Rosados" : /clear/i.test(name) ? "Transparentes" : "No aplica");
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ results: names.map((name, i) => ({ number: i + 1, family: family(name) })) }) }],
  };
});
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create } }; } }));

import { prisma } from "@/lib/prisma";
import { COLOR_FAMILY_ATTRIBUTE } from "@/lib/color-families";
import { applyColorFamilies, listColorCandidates, proposeColorFamilies } from "@/server/services/color-family-service";
import { createBrand, createProduct, hasDb } from "./helpers";

const DIR = path.join(process.cwd(), "public", "uploads", "prueba-colores");
const previousKey = process.env.ANTHROPIC_API_KEY;

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "prueba";
  await mkdir(DIR, { recursive: true });
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#f2a7c3" } }).png().toFile(path.join(DIR, "pink.png"));
});

afterAll(async () => {
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousKey;
  await rm(DIR, { recursive: true, force: true });
});

describe.skipIf(!hasDb)("familias de color con IA", () => {
  it("propone por la foto, guarda sin tocar los demás atributos y se puede quitar", async () => {
    const brand = await createBrand();
    const pink = await createProduct(brand.id, { name: "Builder Gel Shikle 002 Cover Pink", price: 18000, stock: 5 });
    const clear = await createProduct(brand.id, { name: "Builder Gel Shikle Clear", price: 18000, stock: 5 });
    const lima = await createProduct(brand.id, { name: "Lima 100/180", price: 3000, stock: 5 });
    const noPhoto = await createProduct(brand.id, { name: "Base Rubber Pink", price: 15000, stock: 5 });
    await prisma.product.update({ where: { id: pink.id }, data: { imageUrl: "/uploads/prueba-colores/pink.png", attributes: { Grupo: "Builder Gel Shikle", Tono: "002 Cover Pink" } } });
    await prisma.product.update({ where: { id: clear.id }, data: { imageUrl: "/uploads/prueba-colores/pink.png" } });
    await prisma.product.update({ where: { id: lima.id }, data: { imageUrl: "/uploads/prueba-colores/pink.png" } });
    const collection = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Builder Gel", slug: `builder-${brand.id.slice(-6)}` } });
    await prisma.productBrandCollection.create({ data: { productId: pink.id, collectionId: collection.id } });

    const proposals = await proposeColorFamilies(brand.id, [pink.id, clear.id, lima.id, noPhoto.id]);
    expect(proposals).toEqual([
      { productId: pink.id, family: "Rosados", reason: "ia" },
      { productId: clear.id, family: "Transparentes", reason: "ia" },
      { productId: lima.id, family: null, reason: "sin-color" },
      { productId: noPhoto.id, family: null, reason: "sin-foto" },
    ]);
    // A la IA le llegan las fotos chicas, en JPEG, y solo las que tienen foto.
    const sent = create.mock.calls[0][0].messages[0].content;
    expect(sent.filter((b) => b.type === "image").map((b) => b.source?.media_type)).toEqual(["image/jpeg", "image/jpeg", "image/jpeg"]);

    // Un producto de otra marca no se toca.
    const other = await createBrand();
    const foreign = await createProduct(other.id, { name: "Ajeno", price: 1000, stock: 1 });
    expect(await applyColorFamilies(brand.id, [
      { productId: pink.id, family: "Rosados" },
      { productId: clear.id, family: "Transparentes" },
      { productId: foreign.id, family: "Rojos" },
    ])).toEqual({ saved: 2, removed: 0 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: pink.id } })).attributes).toEqual({ Grupo: "Builder Gel Shikle", Tono: "002 Cover Pink", [COLOR_FAMILY_ATTRIBUTE]: "Rosados" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: foreign.id } })).attributes).toEqual({});

    const candidates = await listColorCandidates(brand.id);
    expect(candidates.find((c) => c.id === pink.id)).toMatchObject({ family: "Rosados", collections: ["Builder Gel"] });
    expect(candidates.find((c) => c.id === lima.id)).toMatchObject({ family: null, collections: [] });

    expect(await applyColorFamilies(brand.id, [{ productId: clear.id, family: null }])).toEqual({ saved: 0, removed: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: clear.id } })).attributes).toEqual({});
  });
});
