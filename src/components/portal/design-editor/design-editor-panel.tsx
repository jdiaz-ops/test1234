"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";
import { deepMergeThemeConfig } from "@/lib/brand-theme";
import { DesignPreview } from "./design-preview";
import {
  ColorsSection,
  TypographySection,
  DesignTypeSection,
  HeaderSection,
  AnnouncementSection,
  FooterSection,
  ProductListingSection,
  ProductDetailSection,
  CartSection,
  PopupSection,
  CssSection,
  type Patch,
} from "./design-editor-sections";
import {
  StorefrontSectionsPanel,
  type StorefrontSectionRow,
} from "@/components/portal/storefront-sections-panel";

type NavKey =
  | "colors"
  | "typography"
  | "designType"
  | "header"
  | "sections"
  | "announcement"
  | "footer"
  | "productListing"
  | "productDetail"
  | "cart"
  | "popup"
  | "css";

const NAV_GROUPS: { title: string; items: { key: NavKey; label: string }[] }[] = [
  {
    title: "Imagen de tu marca",
    items: [
      { key: "colors", label: "Colores de tu marca" },
      { key: "typography", label: "Tipo de letra" },
    ],
  },
  {
    title: "Configuración avanzada",
    items: [
      { key: "designType", label: "Tipo de diseño" },
      { key: "header", label: "Encabezado" },
      // Los módulos de la home (banners, colecciones destacadas,
      // productos en oferta, etc.) — antes vivían solo en la pestaña
      // Plantilla, separados de acá; ahora es acá, como en Tiendanube
      // (ver conversación del 2026-09-14).
      { key: "sections", label: "Página de inicio" },
      { key: "announcement", label: "Barra de anuncio" },
      { key: "footer", label: "Pie de página" },
      { key: "productListing", label: "Listado de productos" },
      { key: "productDetail", label: "Detalle del producto" },
      { key: "cart", label: "Carrito de compras" },
      { key: "popup", label: "Pop-up promocional" },
      { key: "css", label: "Edición avanzada de CSS" },
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
}: {
  initialTheme: ThemeConfig;
  storePages: { slug: string; title: string }[];
  initialSections: StorefrontSectionRow[];
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [active, setActive] = useState<NavKey | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
    }
  }

  const activeLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === active)?.label;

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

      <div className="grid lg:grid-cols-[240px_1fr_320px] gap-6">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-3">
          {active && (
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-xs text-brand-accent hover:underline mb-3 flex items-center gap-1"
            >
              ← Volver
            </button>
          )}
          {!active ? (
            <div className="space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-medium text-brand-ink-soft uppercase tracking-wide mb-1.5 px-2">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActive(item.key)}
                        className="w-full text-left rounded-lg px-2 py-1.5 text-sm text-brand-ink hover:bg-brand-accent-soft flex items-center justify-between"
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
            <p className="text-sm font-medium text-brand-ink px-2 py-1.5">{activeLabel}</p>
          )}
        </div>

        <div
          className={`rounded-2xl border border-brand-line bg-brand-surface p-5 min-h-[420px] ${
            active === "sections" ? "lg:col-span-2" : ""
          }`}
        >
          {!active && (
            <p className="text-sm text-brand-ink-soft">Elige una sección de la izquierda para empezar a editar.</p>
          )}
          {active === "colors" && <ColorsSection theme={theme} patch={patch} />}
          {active === "typography" && <TypographySection theme={theme} patch={patch} />}
          {active === "designType" && <DesignTypeSection theme={theme} patch={patch} />}
          {active === "header" && <HeaderSection theme={theme} patch={patch} />}
          {active === "sections" && <StorefrontSectionsPanel initialSections={initialSections} />}
          {active === "announcement" && <AnnouncementSection theme={theme} patch={patch} />}
          {active === "footer" && <FooterSection theme={theme} patch={patch} />}
          {active === "productListing" && <ProductListingSection theme={theme} patch={patch} />}
          {active === "productDetail" && (
            <ProductDetailSection theme={theme} patch={patch} storePages={storePages} />
          )}
          {active === "cart" && <CartSection theme={theme} patch={patch} />}
          {active === "popup" && <PopupSection theme={theme} patch={patch} />}
          {active === "css" && <CssSection theme={theme} patch={patch} />}
        </div>

        {active !== "sections" && (
          <div className="hidden lg:block">
            <DesignPreview theme={theme} brandName="Tu marca" />
          </div>
        )}
      </div>
    </div>
  );
}
