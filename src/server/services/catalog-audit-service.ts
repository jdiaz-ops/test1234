import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/sanitize-html";
import { planFamilyUpdates } from "@/server/services/product-family-service";

/// Diagnóstico del catálogo de una marca: lo que hay que arreglar para
/// que la tienda se vea bien pensada — productos sin descripción o con
/// una de dos líneas, sin foto, agotados, sin peso, sin colección,
/// nombres repetidos o en mayúsculas, familias sin agrupar, colecciones
/// vacías o sin foto. Herramienta del administrador (no la ve la marca):
/// es la lista de trabajo del servicio de "armarles la tienda". Pedido el
/// 2026-10-18 con Rumi (379 productos: 41 agotados, 232 con descripción
/// corta o sin ella, 38 categorías revueltas).

export type AuditItem = { id: string; name: string; slug: string | null; note?: string };
export type AuditSection = {
  key: string;
  title: string;
  /// Por qué importa / qué hacer.
  why: string;
  count: number;
  /// Hasta 150 por sección; el conteo es el total.
  items: AuditItem[];
};
export type CatalogAudit = {
  products: number;
  collections: number;
  sections: AuditSection[];
};

const MAX_ITEMS = 150;
const SHORT_DESCRIPTION = 120;

function section(key: string, title: string, why: string, items: AuditItem[]): AuditSection {
  return { key, title, why, count: items.length, items: items.slice(0, MAX_ITEMS) };
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function auditCatalog(brandId: string): Promise<CatalogAudit> {
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { brandId, manual: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        price: true,
        weight: true,
        stock: true,
        status: true,
        hasVariants: true,
        attributes: true,
        variants: { select: { stock: true } },
        _count: { select: { images: true, brandCollections: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.brandCollection.findMany({
      where: { brandId },
      select: { id: true, name: true, slug: true, imageUrl: true, description: true, _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const live = products.filter((p) => p.status !== "DRAFT");
  const item = (p: { id: string; name: string; slug: string | null }, note?: string): AuditItem => ({ id: p.id, name: p.name, slug: p.slug, ...(note ? { note } : {}) });
  const descriptionLength = (p: { description: string | null }) => (p.description ? stripHtml(p.description).trim().length : 0);
  const soldOut = (p: (typeof products)[number]) =>
    p.hasVariants ? p.variants.length > 0 && p.variants.every((v) => v.stock != null && v.stock <= 0) : p.stock != null && p.stock <= 0;

  // Nombres repetidos (ignorando mayúsculas y tildes).
  const byName = new Map<string, typeof live>();
  for (const p of live) {
    const key = normalizeName(p.name);
    byName.set(key, [...(byName.get(key) ?? []), p]);
  }
  const duplicates = [...byName.values()].filter((g) => g.length > 1).flat();

  const families = planFamilyUpdates(live.map((p) => ({ id: p.id, name: p.name, attributes: p.attributes })));
  const familyNote = new Map<string, string>();
  for (const f of families.families) {
    for (const m of f.members) if (!m.already) familyNote.set(m.id, `${f.group} · ${f.axes.join(" + ")}`);
  }

  const sections: AuditSection[] = [
    section(
      "no-description",
      "Sin descripción",
      "Un producto sin texto no convence ni posiciona en Google. Hay que redactarla: qué es, para qué sirve, cómo se usa, qué trae.",
      live.filter((p) => descriptionLength(p) === 0).map((p) => item(p)),
    ),
    section(
      "short-description",
      "Descripción muy corta",
      `Menos de ${SHORT_DESCRIPTION} caracteres: suele ser una línea suelta. Conviene completarla con uso, beneficios y contenido.`,
      live.filter((p) => descriptionLength(p) > 0 && descriptionLength(p) < SHORT_DESCRIPTION).map((p) => item(p, `${descriptionLength(p)} caracteres`)),
    ),
    section(
      "no-image",
      "Sin foto",
      "No se puede vender lo que no se ve. Pedirle la foto a la marca o tomarla.",
      live.filter((p) => !p.imageUrl && p._count.images === 0).map((p) => item(p)),
    ),
    section(
      "one-image",
      "Una sola foto",
      "Con una segunda foto (en uso, el empaque, el resultado) el producto se entiende mejor.",
      live.filter((p) => (p.imageUrl ? 1 : 0) + p._count.images <= 1 && (p.imageUrl || p._count.images > 0)).map((p) => item(p)),
    ),
    section(
      "sold-out",
      "Agotados",
      "La vitrina los esconde por defecto (Diseño → Catálogo). Si no vuelven, mejor quitarlos; si vuelven, actualizar el inventario.",
      live.filter(soldOut).map((p) => item(p)),
    ),
    section(
      "no-weight",
      "Sin peso",
      "Sin peso el envío no se calcula bien. Agregarlo desde Editar (o en grupo desde la tabla).",
      live.filter((p) => p.weight == null).map((p) => item(p)),
    ),
    section(
      "no-collection",
      "Sin colección",
      "No aparece en ninguna categoría del menú ni en los filtros. Asignarle una (o crearla).",
      live.filter((p) => p._count.brandCollections === 0).map((p) => item(p)),
    ),
    section(
      "duplicates",
      "Nombres repetidos",
      "Dos productos con el mismo nombre confunden al comprador y al buscador. Unirlos o diferenciarlos (tamaño, tono).",
      duplicates.map((p) => item(p)),
    ),
    section(
      "uppercase",
      "Nombre todo en mayúsculas",
      "Se lee como un grito y se ve descuidado. Pasar a mayúscula inicial (por ejemplo \"Aceite de cutícula coco 30 ml\").",
      live.filter((p) => /\p{L}/u.test(p.name) && p.name === p.name.toUpperCase()).map((p) => item(p)),
    ),
    section(
      "zero-price",
      "Precio en cero",
      "Un producto en $0 se puede pedir gratis. Ponerle precio o dejarlo en borrador.",
      live.filter((p) => Number(p.price) <= 0).map((p) => item(p)),
    ),
    section(
      "families",
      "Familias sin agrupar (otros aromas, tonos, tamaños)",
      "Productos que son el mismo en otra presentación y todavía no están enlazados entre sí. Se arreglan con un clic en \"Familias\", acá arriba.",
      live.filter((p) => familyNote.has(p.id)).map((p) => item(p, familyNote.get(p.id))),
    ),
    section(
      "drafts",
      "Borradores",
      "No se ven en la tienda. Los que salieron de \"Separar variantes\" se pueden dejar así; los demás, revisar si deberían estar publicados.",
      products.filter((p) => p.status === "DRAFT").map((p) => item(p)),
    ),
    section(
      "small-collections",
      "Colecciones vacías o con menos de 3 productos",
      "Una categoría con uno o dos productos se ve pobre: unirla con otra o completarla.",
      collections.filter((c) => c._count.products < 3).map((c) => ({ id: c.id, name: c.name, slug: c.slug, note: `${c._count.products} productos` })),
    ),
    section(
      "collections-no-image",
      "Colecciones sin foto",
      "Las secciones de categorías de la portada y el menú se ven mejor con imagen.",
      collections.filter((c) => !c.imageUrl).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    ),
    section(
      "collections-no-description",
      "Colecciones sin descripción",
      "Dos líneas arriba del grid ayudan a entender la categoría y a posicionarla.",
      collections.filter((c) => !c.description || stripHtml(c.description).trim().length === 0).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    ),
  ];

  return { products: live.length, collections: collections.length, sections };
}
