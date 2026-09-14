import { z } from "zod";

/// Secciones de la página de inicio de la vitrina, al estilo Tiendanube
/// — la marca prende/apaga, reordena, y llena el contenido de secciones
/// ya diseñadas (no arma layouts libres bloque por bloque). Ver
/// StorefrontSection en el schema y la conversación del 2026-09-14
/// pidiendo "lo que ofrece Tiendanube".
///
/// El shape de `config` por tipo vive acá (no en el schema, que solo
/// guarda un Json) — un solo lugar para validar tanto al guardar como al
/// leer para renderizar.

export const SECTION_TYPES = ["BANNER", "FEATURED_COLLECTION", "TEXT"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  BANNER: "Banner",
  FEATURED_COLLECTION: "Colección destacada",
  TEXT: "Texto",
};

export const SECTION_TYPE_DESCRIPTION: Record<SectionType, string> = {
  BANNER: "Imagen de ancho completo con título, texto y un botón — ideal para promociones o el hero de tu tienda.",
  FEATURED_COLLECTION: "Muestra los productos de una de tus colecciones en una cuadrícula.",
  TEXT: "Un título y un párrafo — para contar algo de tu marca sin necesidad de imagen.",
};

const bannerConfigSchema = z.object({
  imageUrl: z.string().nullable().default(null),
  title: z.string().max(120).default(""),
  subtitle: z.string().max(240).default(""),
  buttonText: z.string().max(40).default(""),
  buttonLink: z.string().max(300).default(""),
});
export type BannerConfig = z.infer<typeof bannerConfigSchema>;

const featuredCollectionConfigSchema = z.object({
  collectionId: z.string().nullable().default(null),
  title: z.string().max(120).default(""),
});
export type FeaturedCollectionConfig = z.infer<typeof featuredCollectionConfigSchema>;

const textConfigSchema = z.object({
  heading: z.string().max(120).default(""),
  body: z.string().max(2000).default(""),
});
export type TextConfig = z.infer<typeof textConfigSchema>;

export const SECTION_CONFIG_SCHEMA: Record<SectionType, z.ZodTypeAny> = {
  BANNER: bannerConfigSchema,
  FEATURED_COLLECTION: featuredCollectionConfigSchema,
  TEXT: textConfigSchema,
};

export const DEFAULT_SECTION_CONFIG: Record<SectionType, unknown> = {
  BANNER: bannerConfigSchema.parse({}),
  FEATURED_COLLECTION: featuredCollectionConfigSchema.parse({}),
  TEXT: textConfigSchema.parse({}),
};

/// Valida/normaliza el config de una sección según su tipo — tira si no
/// calza con el schema de ese tipo. Se usa al crear/editar (nunca se
/// confía en el JSON tal como llega del cliente).
export function parseSectionConfig(type: SectionType, raw: unknown) {
  return SECTION_CONFIG_SCHEMA[type].parse(raw ?? {});
}
