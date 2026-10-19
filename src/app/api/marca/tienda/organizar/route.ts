import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import {
  applyStoreOrganizer,
  classifyStoreOrganizer,
  lastOrganizerRun,
  planStoreOrganizer,
  prepareStoreOrganizer,
  StoreOrganizerError,
  undoStoreOrganizer,
} from "@/server/services/store-organizer-service";

/// Organizador automático de tienda (solo admin con "Entrar como" — ver
/// store-organizer-service.ts). El navegador va por pasos para que ninguna
/// petición se pase del tiempo máximo: "prepare" (define las colecciones
/// con IA, o devuelve el plan por reglas), "classify" por tandas, "plan"
/// (arma el plan sin tocar nada), "apply" (lo aplica tal como se mostró)
/// y "undo". GET solo dice si hay algo para deshacer.
export const maxDuration = 60;

const FORBIDDEN = { error: "Solo el administrador de Marcolini puede usar esta herramienta." };

const plannedCollection: z.ZodType<PlannedCollectionInput> = z.lazy(() =>
  z.object({
    key: z.string().min(1).max(120),
    existingId: z.string().nullable(),
    name: z.string().min(2).max(80),
    slug: z.string().min(1).max(120),
    description: z.string().max(500),
    imageUrl: z.string().max(1000).nullable(),
    productIds: z.array(z.string()).max(5000),
    demand: z.number(),
    sold: z.number(),
    children: z.array(plannedCollection).max(30),
  }),
);
type PlannedCollectionInput = {
  key: string;
  existingId: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  productIds: string[];
  demand: number;
  sold: number;
  children: PlannedCollectionInput[];
};

const menuItem: z.ZodType<{ label: string; url: string; children: { label: string; url: string; children: unknown[] }[] }> = z.lazy(() =>
  z.object({ label: z.string().min(1).max(60), url: z.string().min(1).max(300), children: z.array(menuItem).max(40) }),
) as never;

const homeSection = z.discriminatedUnion("type", [
  z.object({ type: z.literal("BANNER"), collectionKey: z.string(), imageUrl: z.string().max(1000), title: z.string().max(120), subtitle: z.string().max(240), buttonText: z.string().max(40) }),
  z.object({ type: z.literal("CATEGORY_GRID"), title: z.string().max(120), collectionKeys: z.array(z.string()).max(6) }),
  z.object({ type: z.literal("FEATURED_PRODUCTS"), title: z.string().max(80), productIds: z.array(z.string()).max(24) }),
  z.object({ type: z.literal("ON_SALE_PRODUCTS"), title: z.string().max(80) }),
  z.object({ type: z.literal("NEW_PRODUCTS"), title: z.string().max(80) }),
  z.object({ type: z.literal("SHIPPING_INFO_BANNERS"), whatsapp: z.boolean() }),
  z.object({ type: z.literal("INSTAGRAM_CTA") }),
  z.object({ type: z.literal("PRODUCT_CATALOG"), title: z.string().max(120) }),
]);

const planSchema = z.object({
  source: z.enum(["ia", "reglas"]),
  collections: z.array(plannedCollection).max(60),
  removedCollections: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), count: z.number(), movedTo: z.string().nullable() })).max(500),
  productNames: z.array(z.object({ id: z.string(), from: z.string(), to: z.string().max(255) })).max(5000),
  menu: z.array(menuItem).max(20),
  home: z.array(homeSection).max(12),
  stats: z.object({
    products: z.number(),
    active: z.number(),
    soldOut: z.number(),
    withSales: z.number(),
    collectionsBefore: z.number(),
    collectionsAfter: z.number(),
    subcollections: z.number(),
    renamed: z.number(),
    discounted: z.number(),
  }),
});

const definedCollection = z.object({ name: z.string().min(2).max(40), description: z.string().max(160), children: z.array(z.string().min(2).max(40)).max(8) });
const assignment = z.object({ id: z.string(), collection: z.string().max(60), child: z.string().max(60).nullable() });
const productName = z.object({ id: z.string(), name: z.string().min(2).max(255) });

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({ action: z.literal("classify"), collections: z.array(definedCollection).min(1).max(12), ids: z.array(z.string()).min(1).max(200) }),
  // Un solo "plan" (zod no admite dos miembros con el mismo action): con
  // mode "ia" tienen que venir las definiciones y asignaciones.
  z.object({
    action: z.literal("plan"),
    mode: z.enum(["reglas", "ia"]),
    definitions: z.array(definedCollection).max(12).optional(),
    assignments: z.array(assignment).max(5000).optional(),
    productNames: z.array(productName).max(5000).optional(),
  }),
  z.object({ action: z.literal("apply"), plan: planSchema }),
  z.object({ action: z.literal("undo") }),
]);

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  return NextResponse.json({ ok: true, lastRun: await lastOrganizerRun(profile.id) });
}

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  const limited = await limitOrReject(req, `organizar:${profile.id}`, 30, 3600);
  if (limited) return limited;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "El plan no es válido. Vuelve a generarlo." }, { status: 400 });
  try {
    const data = body.data;
    switch (data.action) {
      case "prepare":
        return NextResponse.json({ ok: true, ...(await prepareStoreOrganizer(profile.id)), lastRun: await lastOrganizerRun(profile.id) });
      case "classify": {
        const result = await classifyStoreOrganizer(profile.id, { collections: data.collections, ids: data.ids });
        if (!result) return NextResponse.json({ error: "La IA no respondió para esta tanda." }, { status: 422 });
        return NextResponse.json({ ok: true, ...result });
      }
      case "plan": {
        if (data.mode === "ia" && !data.definitions?.length) {
          return NextResponse.json({ error: "Faltan las colecciones definidas. Vuelve a generar el plan." }, { status: 400 });
        }
        const plan = await planStoreOrganizer(
          profile.id,
          data.mode === "reglas"
            ? { mode: "reglas" }
            : { mode: "ia", definitions: data.definitions ?? [], assignments: data.assignments ?? [], productNames: data.productNames ?? [] },
        );
        return NextResponse.json({ ok: true, plan, lastRun: await lastOrganizerRun(profile.id) });
      }
      case "undo": {
        const result = await undoStoreOrganizer(profile.id);
        return NextResponse.json({ ok: true, ...result, lastRun: await lastOrganizerRun(profile.id) });
      }
      case "apply": {
        const summary = await applyStoreOrganizer(profile.id, data.plan as never);
        return NextResponse.json({ ok: true, summary, lastRun: await lastOrganizerRun(profile.id) });
      }
    }
  } catch (err) {
    if (err instanceof StoreOrganizerError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[organizar]", err);
    return NextResponse.json({ error: "No se pudo aplicar la organización." }, { status: 500 });
  }
}
