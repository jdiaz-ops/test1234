"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";
import { deepMergeThemeConfig } from "@/lib/brand-theme";
import { DesignPreview } from "./design-preview";
import {
  ColorsSection,
  TypographySection,
  HeaderSection,
  MenuVisibilitySection,
  AnnouncementSection,
  FooterSection,
  ProductListingSection,
  CollectionsSection,
  ProductDetailSection,
  CartSection,
  MobileNavSection,
  PopupSection,
  type Patch,
} from "./design-editor-sections";
import {
  StorefrontSectionsPanel,
  type StorefrontSectionRow,
} from "@/components/portal/storefront-sections-panel";
import {
  StorefrontMenuPanel,
  type StorefrontMenuItemRow,
} from "@/components/portal/storefront-menu-panel";
import { StorefrontTemplateForm } from "@/components/portal/storefront-template-form";

/// "Tipo de diseño" (DesignTypeSection) y "Edición avanzada de CSS"
/// (CssSection) ya no se muestran — pedido explícito de simplificar el
/// editor, ver conversación del 2026-09-30. Los valores guardados siguen
/// aplicando (bordes redondeados por defecto; el CSS propio que alguna
/// marca ya tuviera), solo no se editan desde acá.
type NavKey =
  | "colors"
  | "typography"
  | "header"
  | "menu"
  | "sections"
  | "announcement"
  | "footer"
  | "productListing"
  | "collections"
  | "productDetail"
  | "cart"
  | "mobileNav"
  | "popup";

/// NavKeys cuya sección de abajo es un panel autosuficiente (lista + CRUD
/// propio, con su propio fetch), no un formulario del tema — ocupan las 2
/// columnas del medio y no tiene sentido mostrarles el preview en vivo al
/// lado (no reflejan un cambio de tema).
const WIDE_PANELS: NavKey[] = ["sections", "menu"];

const NAV_GROUPS: { title: string; items: { key: NavKey; label: string }[] }[] = [
  {
    title: "Imagen de tu marca",
    items: [
      { key: "colors", label: "Colores" },
      { key: "typography", label: "Tipo de letra" },
    ],
  },
  {
    // En el orden en que el comprador los ve, de arriba hacia abajo —
    // pedido explícito de la marca, ver conversación del 2026-09-30.
    title: "Estructura de tu tienda",
    items: [
      { key: "announcement", label: "Barra de anuncio" },
      { key: "header", label: "Encabezado" },
      // Antes vivía en Páginas, separado del resto del diseño — se mudó
      // acá porque es tan "diseño" como el resto (qué ve el comprador en
      // el header). Ver conversación del 2026-09-14.
      { key: "menu", label: "Menú" },
      // Los módulos de la home (banners, colecciones destacadas,
      // productos en oferta, etc.) — antes vivían solo en la pestaña
      // Plantilla, separados de acá; ahora es acá, como en Tiendanube
      // (ver conversación del 2026-09-14).
      { key: "sections", label: "Página de inicio" },
      { key: "mobileNav", label: "Barra inferior (celular)" },
      { key: "footer", label: "Pie de página" },
    ],
  },
  {
    // Nombres cortos y explícitos: "Catálogo" reúne la plantilla (antes
    // su propia pestaña "Plantilla") y las opciones del listado; "Página
    // de colección" para no confundir con Colecciones del menú lateral.
    title: "Otras páginas",
    items: [
      { key: "productListing", label: "Catálogo" },
      { key: "collections", label: "Página de colección" },
      { key: "productDetail", label: "Página de producto" },
      { key: "cart", label: "Carrito" },
      { key: "popup", label: "Pop-up promocional" },
    ],
  },
];

/// Editor de Diseño — panel izquierdo con las mismas secciones que
/// Tiendanube, preview en vivo a la derecha, y un modelo de borrador/
/// publicado real: cada cambio se guarda automático como borrador (nunca
/// se pierde si recargás la página), pero la vitrina pública no se
/// entera hasta "Publicar cambios". Ver conversación del 2026-09-14.
export function DesignEditorPanel({
  initialTheme,
  storePages,
  initialSections,
  initialMenuItems,
  storefrontSlug,
  initialTemplate,
}: {
  initialTheme: ThemeConfig;
  storePages: { slug: string; title: string }[];
  initialSections: StorefrontSectionRow[];
  initialMenuItems: StorefrontMenuItemRow[];
  /// Para la vista previa (la tienda real en un iframe) — null si la
  /// marca todavía no configuró el link de su tienda.
  storefrontSlug: string | null;
  /// Plantilla del catálogo (Clásica/Minimal/Editorial) — vive en
  /// BrandProfile, no en el tema; antes tenía su propia pestaña
  /// "Plantilla", ahora se elige en Catálogo. Ver conversación del
  /// 2026-09-30.
  initialTemplate: string;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [active, setActive] = useState<NavKey | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Sube con cada borrador guardado — la vista previa recarga al verlo cambiar.
  const [previewVersion, setPreviewVersion] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishedJustNow, setPublishedJustNow] = useState(false);
  const pendingPatch = useRef<Patch>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /// Devuelve la promesa del fetch — handlePublish la espera antes de
  /// publicar, para no copiar un borrador viejo si la marca le da a
  /// "Publicar cambios" justo después de tocar algo (el debounce de
  /// abajo todavía no había disparado el guardado).
  function flushPatch(): Promise<void> {
    const toSend = pendingPatch.current;
    pendingPatch.current = {};
    if (Object.keys(toSend).length === 0) return Promise.resolve();
    setSaveStatus("saving");
    return fetch("/api/marca/tienda/diseno", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSend),
    })
      .then((r) => r.json())
      .then((body) => {
        setSaveStatus(body?.ok ? "saved" : "error");
        if (body?.ok) setPreviewVersion((v) => v + 1);
      })
      .catch(() => setSaveStatus("error"));
  }

  function patch(p: Patch) {
    setTheme((prev) => deepMergeThemeConfig(prev as unknown as Record<string, unknown>, p) as unknown as ThemeConfig);
    pendingPatch.current = deepMergeThemeConfig(pendingPatch.current, p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPatch, 600);
  }

  // Guarda lo pendiente si la marca cierra/navega antes de que el debounce dispare.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushPatch();
    };
  }, []);

  async function handlePublish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await flushPatch();
    setPublishing(true);
    try {
      const res = await fetch("/api/marca/tienda/diseno/publicar", { method: "POST" });
      if (res.ok) {
        setPublishedJustNow(true);
        setTimeout(() => setPublishedJustNow(false), 3000);
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscard() {
    if (!window.confirm("¿Descartar los cambios sin publicar? Vuelve a lo último publicado.")) return;
    const res = await fetch("/api/marca/tienda/diseno/descartar", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.theme) {
      setTheme(body.theme);
      pendingPatch.current = {};
      setPreviewVersion((v) => v + 1);
    }
  }

  const activeLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === active)?.label;
  const isWide = active != null && WIDE_PANELS.includes(active);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-brand-ink-soft">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Diseño actual
          </span>
          {saveStatus === "saving" && <span className="text-xs text-brand-ink-soft">Guardando borrador...</span>}
          {saveStatus === "saved" && <span className="text-xs text-brand-ink-soft">Borrador guardado</span>}
          {saveStatus === "error" && <span className="text-xs text-red-600">No se pudo guardar — revisa tu conexión</span>}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleDiscard} className="text-xs text-brand-ink-soft hover:underline">
            Descartar cambios
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {publishing ? "Publicando..." : publishedJustNow ? "Publicado ✓" : "Publicar cambios"}
          </button>
        </div>
      </div>

      {/* Un solo panel de edición a la izquierda (la lista de secciones, y al
          elegir una, su formulario en ese mismo lugar — como el editor de
          Shopify) y la vista previa real ocupando todo el resto. Antes eran
          tres columnas: la de la izquierda quedaba vacía apenas se elegía
          algo y la del medio tan angosta que los campos se cortaban ("la
          columna del centro la info no sale del todo"). Ver conversación
          del 2026-09-30. Los paneles anchos (Página de inicio, Menú) usan
          todo el ancho y esconden la vista previa. */}
      <div className={`grid gap-6 ${isWide ? "" : "lg:grid-cols-[420px_minmax(0,1fr)]"}`}>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 min-h-[420px]">
          {!active ? (
            <div className="space-y-5">
              <p className="text-sm text-brand-ink-soft">
                Elige qué parte de tu tienda editar — a la derecha ves el resultado con tus cambios sin publicar.
              </p>
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-medium text-brand-ink-soft uppercase tracking-wide mb-1.5">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActive(item.key)}
                        className="w-full text-left rounded-lg px-3 py-2.5 text-sm text-brand-ink hover:bg-brand-accent-soft flex items-center justify-between"
                      >
                        {item.label}
                        <span className="text-brand-ink-soft">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-xs text-brand-accent hover:underline mb-2 flex items-center gap-1"
              >
                ← Todas las secciones
              </button>
              <h2 className="font-display text-lg font-semibold text-brand-ink mb-4">{activeLabel}</h2>
            </>
          )}
          {active === "colors" && <ColorsSection theme={theme} patch={patch} />}
          {active === "typography" && <TypographySection theme={theme} patch={patch} />}
          {active === "header" && <HeaderSection theme={theme} patch={patch} />}
          {active === "menu" && (
            <>
              <MenuVisibilitySection theme={theme} patch={patch} />
              <StorefrontMenuPanel initialItems={initialMenuItems} />
            </>
          )}
          {active === "sections" && <StorefrontSectionsPanel initialSections={initialSections} />}
          {active === "announcement" && <AnnouncementSection theme={theme} patch={patch} />}
          {active === "footer" && <FooterSection theme={theme} patch={patch} />}
          {active === "productListing" && (
            <div className="space-y-6">
              <StorefrontTemplateForm initialTemplate={initialTemplate} />
              <ProductListingSection theme={theme} patch={patch} />
            </div>
          )}
          {active === "collections" && <CollectionsSection theme={theme} patch={patch} />}
          {active === "productDetail" && (
            <ProductDetailSection theme={theme} patch={patch} storePages={storePages} />
          )}
          {active === "cart" && <CartSection theme={theme} patch={patch} />}
          {active === "mobileNav" && <MobileNavSection theme={theme} patch={patch} />}
          {active === "popup" && <PopupSection theme={theme} patch={patch} />}
        </div>

        {!isWide && (
          <div className="hidden lg:block min-w-0">
            <DesignPreview storefrontSlug={storefrontSlug} version={previewVersion} />
          </div>
        )}
      </div>
    </div>
  );
}
