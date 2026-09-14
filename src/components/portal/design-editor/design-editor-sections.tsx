"use client";

import { useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";
import { GOOGLE_FONT_OPTIONS, COLOR_PRESETS, TRUST_ICON_OPTIONS } from "@/lib/brand-theme";

export type Patch = Record<string, unknown>;
export type PatchFn = (patch: Patch) => void;

/// Botón compartido para subir una imagen (colores/footer/pop-up/etc.) —
/// mismo endpoint que usa el resto del portal para fotos de producto, la
/// carpeta es solo un prefijo de almacenamiento, no una validación.
function ImageUploadButton({
  imageUrl,
  onChange,
  label = "Subir imagen",
  recommendedSize,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  recommendedSize?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/marca/tienda/productos/imagen", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.url) onChange(body.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen subida por la marca
        <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-brand-line" />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-brand-bg border border-dashed border-brand-line" />
      )}
      <div>
        <label className="text-xs border border-brand-line rounded-full px-3 py-1.5 hover:bg-brand-accent-soft cursor-pointer inline-block">
          {uploading ? "Subiendo..." : imageUrl ? "Cambiar" : label}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleUpload(e.target.files?.[0])}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:underline ml-2"
          >
            Quitar
          </button>
        )}
        {recommendedSize && (
          <p className="text-[11px] text-brand-ink-soft mt-1">Tamaño recomendado: {recommendedSize}</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-brand-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-brand-ink-soft mt-1">{hint}</p>}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-brand-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ----------------------------------------------------------------------------
// Colores
// ----------------------------------------------------------------------------

export function ColorsSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const c = theme.colors;
  const setColor = (key: keyof ThemeConfig["colors"], value: string | boolean) =>
    patch({ colors: { [key]: value } });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ColorRow label="Color principal" hint="Botones, precio, links, firma de marca." value={c.principal} onChange={(v) => setColor("principal", v)} />
        <ColorRow label="Color secundario" hint="Fondo de la barra de anuncio." value={c.secundario} onChange={(v) => setColor("secundario", v)} />
        <div>
          <ColorRow label="Color de acento" hint="Promociones, descuentos, envío gratis." value={c.acento} onChange={(v) => setColor("acento", v)} disabled={!c.usarAcento} />
          <label className="flex items-center gap-2 text-xs text-brand-ink-soft mt-1 ml-1">
            <input type="checkbox" checked={c.usarAcento} onChange={(e) => setColor("usarAcento", e.target.checked)} />
            Usar color de acento
          </label>
        </div>
      </div>

      <div className="border-t border-brand-line pt-4 space-y-4">
        <p className="text-xs font-medium text-brand-ink">Colores de contraste</p>
        <ColorRow label="Color de fondo" value={c.fondo} onChange={(v) => setColor("fondo", v)} />
        <ColorRow label="Color de textos" value={c.texto} onChange={(v) => setColor("texto", v)} />
      </div>

      <div className="border-t border-brand-line pt-4">
        <p className="text-xs font-medium text-brand-ink mb-2">Combinaciones predeterminadas</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => patch({ colors: preset.colors })}
              className="rounded-lg border border-brand-line overflow-hidden w-16 hover:border-brand-accent"
              title={preset.name}
            >
              <div className="h-6" style={{ background: preset.colors.principal }} />
              <div className="h-3" style={{ background: preset.colors.texto }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? "opacity-40" : ""}`}>
      <input
        type="color"
        value={/^#([0-9a-f]{6})$/i.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-10 h-10 rounded-lg border border-brand-line cursor-pointer shrink-0"
      />
      <div>
        <p className="text-sm text-brand-ink">{label}</p>
        {hint && <p className="text-xs text-brand-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tipografía
// ----------------------------------------------------------------------------

export function TypographySection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  return (
    <div className="space-y-4 max-w-sm">
      <Field label="Títulos de páginas y banners">
        <select
          value={theme.typography.headingFont}
          onChange={(e) => patch({ typography: { headingFont: e.target.value } })}
          className="input text-sm"
        >
          {GOOGLE_FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Texto en el resto del sitio">
        <select
          value={theme.typography.bodyFont}
          onChange={(e) => patch({ typography: { bodyFont: e.target.value } })}
          className="input text-sm"
        >
          {GOOGLE_FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tipo de diseño
// ----------------------------------------------------------------------------

export function DesignTypeSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  return (
    <div className="space-y-6 max-w-sm">
      <div>
        <p className="text-xs font-medium text-brand-ink mb-2">Bordes</p>
        <p className="text-xs text-brand-ink-soft mb-2">Define el aspecto general de los bordes (fotos y banners principalmente).</p>
        <Checkbox
          label="Usar bordes redondeados"
          checked={theme.designType.roundedBorders}
          onChange={(v) => patch({ designType: { roundedBorders: v } })}
        />
      </div>
      <div>
        <p className="text-xs font-medium text-brand-ink mb-2">Íconos</p>
        <p className="text-xs text-brand-ink-soft mb-2">
          Guardado para más adelante — todavía no cambia nada visible (la vitrina no usa hoy un sistema de íconos con variante grueso/fino).
        </p>
        <Checkbox
          label="Usar íconos gruesos"
          checked={theme.designType.boldIcons}
          onChange={(v) => patch({ designType: { boldIcons: v } })}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Encabezado
// ----------------------------------------------------------------------------

export function HeaderSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const h = theme.header;
  return (
    <div className="space-y-6 max-w-sm">
      <Field label="Color de fondo del encabezado">
        <select
          value={h.bgColorRef}
          onChange={(e) => patch({ header: { bgColorRef: e.target.value } })}
          className="input text-sm"
        >
          <option value="fondo">Color de fondo</option>
          <option value="principal">Color principal</option>
          <option value="texto">Color de textos</option>
        </select>
      </Field>
      <Checkbox
        label="Encabezado siempre visible al navegar el sitio"
        checked={h.sticky}
        onChange={(v) => patch({ header: { sticky: v } })}
      />
      <Field label="Tamaño del logo">
        <select
          value={h.logoSize}
          onChange={(e) => patch({ header: { logoSize: e.target.value } })}
          className="input text-sm"
        >
          <option value="small">Pequeño</option>
          <option value="medium">Mediano</option>
          <option value="large">Grande</option>
        </select>
      </Field>

      <div className="border-t border-brand-line pt-4 space-y-3">
        <p className="text-xs font-medium text-brand-ink">Encabezado en celulares</p>
        <Field label="Ubicación del logo">
          <select
            value={h.mobile.logoPosition}
            onChange={(e) => patch({ header: { mobile: { logoPosition: e.target.value } } })}
            className="input text-sm"
          >
            <option value="center">Centrado</option>
            <option value="left">Izquierda</option>
          </select>
        </Field>
        <Field label="Mostrar" hint={h.mobile.show === "search" ? "Sin buscador en Marcolini todavía — se usa como link a Categorías." : undefined}>
          <select
            value={h.mobile.show}
            onChange={(e) => patch({ header: { mobile: { show: e.target.value } } })}
            className="input text-sm"
          >
            <option value="search">Buscador grande</option>
            <option value="categories">Barra horizontal de categorías</option>
            <option value="icons">Sólo íconos (menú, buscador y carrito)</option>
          </select>
        </Field>
      </div>

      <div className="border-t border-brand-line pt-4 space-y-3">
        <p className="text-xs font-medium text-brand-ink">Encabezado en computadoras</p>
        <Field label="Ubicación del logo">
          <select
            value={h.desktop.logoPosition}
            onChange={(e) => patch({ header: { desktop: { logoPosition: e.target.value } } })}
            className="input text-sm"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centrado</option>
          </select>
        </Field>
        <Field label="Tamaño de íconos" hint="Aplica al botón de carrito.">
          <select
            value={h.desktop.iconSize}
            onChange={(e) => patch({ header: { desktop: { iconSize: e.target.value } } })}
            className="input text-sm"
          >
            <option value="large">Grande</option>
            <option value="small">Pequeño</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Barra de anuncio
// ----------------------------------------------------------------------------

export function AnnouncementSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const a = theme.announcementBar;
  const messages = [0, 1, 2].map((i) => a.messages[i] ?? { text: "", link: "" });

  function updateMessage(index: number, field: "text" | "link", value: string) {
    const next = messages.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    patch({ announcementBar: { messages: next.filter((m) => m.text.trim() || m.link?.trim()) } });
  }

  return (
    <div className="space-y-4 max-w-sm">
      <Checkbox
        label="Mostrar barra de anuncio"
        checked={a.enabled}
        onChange={(v) => patch({ announcementBar: { enabled: v } })}
      />
      {messages.map((m, i) => (
        <div key={i} className="space-y-2">
          <p className="text-xs font-medium text-brand-ink">Mensaje {i + 1}</p>
          <Field label="Texto">
            <input
              value={m.text}
              onChange={(e) => updateMessage(i, "text", e.target.value)}
              className="input text-sm"
              maxLength={200}
            />
          </Field>
          <Field label="Link (opcional)">
            <input
              value={m.link ?? ""}
              onChange={(e) => updateMessage(i, "link", e.target.value)}
              className="input text-sm"
              placeholder="/coleccion/nueva"
            />
          </Field>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Footer
// ----------------------------------------------------------------------------

export function FooterSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const f = theme.footer;
  return (
    <div className="space-y-6 max-w-sm">
      <div>
        <p className="text-xs font-medium text-brand-ink mb-2">Colores</p>
        <Checkbox
          label="Usar colores propios para el pie de página"
          checked={f.useCustomColors}
          onChange={(v) => patch({ footer: { useCustomColors: v } })}
        />
        {f.useCustomColors && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Field label="Color de fondo">
              <select
                value={f.bgColorRef}
                onChange={(e) => patch({ footer: { bgColorRef: e.target.value } })}
                className="input text-sm"
              >
                <option value="texto">Color de textos</option>
                <option value="principal">Color principal</option>
                <option value="secundario">Color secundario</option>
                <option value="acento">Color de acento</option>
                <option value="fondo">Color de fondo</option>
              </select>
            </Field>
            <Field label="Color de textos e íconos">
              <select
                value={f.textColorRef}
                onChange={(e) => patch({ footer: { textColorRef: e.target.value } })}
                className="input text-sm"
              >
                <option value="fondo">Color de fondo</option>
                <option value="principal">Color principal</option>
                <option value="secundario">Color secundario</option>
                <option value="acento">Color de acento</option>
                <option value="texto">Color de textos</option>
              </select>
            </Field>
          </div>
        )}
      </div>

      <div className="border-t border-brand-line pt-4">
        <Checkbox label='Mostrar "Sobre nosotros"' checked={f.aboutUs.show} onChange={(v) => patch({ footer: { aboutUs: { show: v } } })} />
        {f.aboutUs.show && (
          <div className="space-y-2 mt-2">
            <Field label="Título">
              <input value={f.aboutUs.title} onChange={(e) => patch({ footer: { aboutUs: { title: e.target.value } } })} className="input text-sm" />
            </Field>
            <Field label="Descripción">
              <textarea value={f.aboutUs.description} onChange={(e) => patch({ footer: { aboutUs: { description: e.target.value } } })} className="input text-sm min-h-16" />
            </Field>
          </div>
        )}
      </div>

      <div className="border-t border-brand-line pt-4">
        <Checkbox label="Mostrar menú principal" checked={f.menuPrimary.show} onChange={(v) => patch({ footer: { menuPrimary: { show: v } } })} />
        {f.menuPrimary.show && (
          <Field label="Título" hint="Usa tu Menú de navegación (ver Páginas) — cámbiale solo el título acá.">
            <input value={f.menuPrimary.title} onChange={(e) => patch({ footer: { menuPrimary: { title: e.target.value } } })} className="input text-sm mt-2" />
          </Field>
        )}
      </div>

      <div className="border-t border-brand-line pt-4">
        <Checkbox label="Mostrar menú secundario" checked={f.menuSecondary.show} onChange={(v) => patch({ footer: { menuSecondary: { show: v } } })} />
        {f.menuSecondary.show && (
          <Field label="Título">
            <input value={f.menuSecondary.title} onChange={(e) => patch({ footer: { menuSecondary: { title: e.target.value } } })} className="input text-sm mt-2" />
          </Field>
        )}
      </div>

      <div className="border-t border-brand-line pt-4">
        <Checkbox label="Mostrar datos de contacto" checked={f.contact.show} onChange={(v) => patch({ footer: { contact: { show: v } } })} />
        {f.contact.show && (
          <Field label="Título" hint="Usa el teléfono y sitio web de Configuración → Perfil.">
            <input value={f.contact.title} onChange={(e) => patch({ footer: { contact: { title: e.target.value } } })} className="input text-sm mt-2" />
          </Field>
        )}
      </div>

      <div className="border-t border-brand-line pt-4">
        <Field label="Título de redes sociales" hint="Usa tu Instagram/TikTok de Configuración → Perfil.">
          <input value={f.social.title} onChange={(e) => patch({ footer: { social: { title: e.target.value } } })} className="input text-sm" />
        </Field>
      </div>

      <div className="border-t border-brand-line pt-4 space-y-2">
        <Checkbox label="Mostrar las opciones de envío en tu sitio" checked={f.showShippingOptions} onChange={(v) => patch({ footer: { showShippingOptions: v } })} />
        <Checkbox label="Mostrar los métodos de pago en tu sitio" checked={f.showPaymentMethods} onChange={(v) => patch({ footer: { showPaymentMethods: v } })} />
        <p className="text-[11px] text-brand-ink-soft">Guardado para más adelante — todavía no se dibujan los logos en el footer.</p>
      </div>

      <div className="border-t border-brand-line pt-4">
        <p className="text-xs font-medium text-brand-ink mb-2">Sellos personalizados en el footer</p>
        <p className="text-[11px] text-brand-ink-soft mb-2">Solo imagen — a diferencia de otras plataformas, acá no se acepta pegar código, para no abrir una puerta a scripts maliciosos en tu vitrina.</p>
        <div className="space-y-2">
          {f.seals.map((seal, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- sello subido por la marca */}
              <img src={seal.imageUrl} alt="" className="w-8 h-8 object-contain" />
              <button
                type="button"
                onClick={() => patch({ footer: { seals: f.seals.filter((_, idx) => idx !== i) } })}
                className="text-xs text-red-600 hover:underline"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        {f.seals.length < 6 && (
          <div className="mt-2">
            <ImageUploadButton
              imageUrl={null}
              label="+ Agregar sello"
              recommendedSize="24×24px"
              onChange={(url) => url && patch({ footer: { seals: [...f.seals, { imageUrl: url }] } })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Listado de productos
// ----------------------------------------------------------------------------

export function ProductListingSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const p = theme.productListing;
  return (
    <div className="space-y-4 max-w-sm">
      <Field label="Productos por fila">
        <select
          value={p.productsPerRow}
          onChange={(e) => patch({ productListing: { productsPerRow: e.target.value } })}
          className="input text-sm"
        >
          <option value="1-3">1 en celular y 3 en computadora</option>
          <option value="2-4">2 en celular y 4 en computadora</option>
        </select>
      </Field>
      <Checkbox label="Compra rápida desde el listado" checked={p.quickAdd} onChange={(v) => patch({ productListing: { quickAdd: v } })} />
      <div className="space-y-2">
        <Checkbox label="Mostrar variantes de color en el listado" checked={p.showColorVariants} onChange={(v) => patch({ productListing: { showColorVariants: v } })} />
        <Checkbox label="Mostrar la segunda foto al pasar el mouse" checked={p.hoverSecondPhoto} onChange={(v) => patch({ productListing: { hoverSecondPhoto: v } })} />
        <Checkbox label="Mostrar las fotos en un carrusel por producto" checked={p.photoCarousel} onChange={(v) => patch({ productListing: { photoCarousel: v } })} />
        <p className="text-[11px] text-brand-ink-soft">
          Estas 3 quedan guardadas para más adelante — el listado hoy solo trae una foto por producto, faltaría traer la galería completa a la tarjeta para que se vean.
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Colecciones — las landing de categoría (/coleccion/{slug}).
// ----------------------------------------------------------------------------

export function CollectionsSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const c = theme.collections;
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-xs text-brand-ink-soft">
        Cómo se ve la tarjeta de producto en la página de cada colección
        (categoría) de tu tienda — siempre 2 por fila, en cualquier
        pantalla. No afecta el listado principal de tu home, ese se
        configura en &ldquo;Listado de productos&rdquo;.
      </p>
      <div className="space-y-2">
        <Checkbox label="Mostrar imagen del producto" checked={c.showImage} onChange={(v) => patch({ collections: { showImage: v } })} />
        <Checkbox label="Mostrar título del producto" checked={c.showTitle} onChange={(v) => patch({ collections: { showTitle: v } })} />
        <Checkbox
          label='Mostrar botón "Ver producto"'
          checked={c.showViewProductButton}
          onChange={(v) => patch({ collections: { showViewProductButton: v } })}
        />
        <Checkbox
          label='Mostrar botón "Agregar al carrito"'
          checked={c.showAddToCartButton}
          onChange={(v) => patch({ collections: { showAddToCartButton: v } })}
        />
      </div>
      <p className="text-[11px] text-brand-ink-soft">
        Tamaño recomendado de foto: cuadrada, 1000×1000px (mínimo
        800×800px) — así se ve nítida en pantallas de alta resolución sin
        pesar de más.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Detalle de producto
// ----------------------------------------------------------------------------

export function ProductDetailSection({
  theme,
  patch,
  storePages,
}: {
  theme: ThemeConfig;
  patch: PatchFn;
  storePages: { slug: string; title: string }[];
}) {
  const d = theme.productDetail;
  return (
    <div className="space-y-5 max-w-sm">
      <Checkbox
        label="Botón flotante de agregar al carrito"
        checked={d.floatingAddToCart}
        onChange={(v) => patch({ productDetail: { floatingAddToCart: v } })}
      />
      <p className="text-[11px] text-brand-ink-soft -mt-3">
        Aparece abajo cuando el comprador scrollea y pierde de vista el
        botón principal — te conviene tenerlo prendido.
      </p>
      <Checkbox label="Mostrar calculadora de envío en la ficha" checked={d.shippingCalculator} onChange={(v) => patch({ productDetail: { shippingCalculator: v } })} />
      <Checkbox label="Mostrar el monto ahorrado por descuento" checked={d.showSavedAmount} onChange={(v) => patch({ productDetail: { showSavedAmount: v } })} />
      <Checkbox label="Mostrar variantes como botones" checked={d.variantsAsButtons} onChange={(v) => patch({ productDetail: { variantsAsButtons: v } })} />
      <Checkbox label="Mostrar la foto de la variante de color como botón" checked={d.colorVariantAsPhoto} onChange={(v) => patch({ productDetail: { colorVariantAsPhoto: v } })} />

      <Field label="Guía de tallas" hint="Enlaza una de tus Páginas propias.">
        <select
          value={d.sizeGuidePageSlug ?? ""}
          onChange={(e) => patch({ productDetail: { sizeGuidePageSlug: e.target.value || null } })}
          className="input text-sm"
        >
          <option value="">Sin guía de tallas</option>
          {storePages.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>

      <Checkbox label="Mostrar stock disponible" checked={d.showStock} onChange={(v) => patch({ productDetail: { showStock: v } })} />

      <div className="border-t border-brand-line pt-4 space-y-2">
        <p className="text-xs font-medium text-brand-ink">Últimas unidades en stock</p>
        <Checkbox
          label="Mostrar mensaje de urgencia cuando queden pocas"
          checked={d.lowStock.enabled}
          onChange={(v) => patch({ productDetail: { lowStock: { enabled: v } } })}
        />
        {d.lowStock.enabled && (
          <>
            <Field label="Mostrar cuando queden menos de:">
              <input
                type="number"
                min="1"
                value={d.lowStock.threshold}
                onChange={(e) => patch({ productDetail: { lowStock: { threshold: Number(e.target.value) || 1 } } })}
                className="input text-sm"
              />
            </Field>
            <Field label="Mensaje cuando queda 1 unidad">
              <input
                value={d.lowStock.lastUnitMessage}
                onChange={(e) => patch({ productDetail: { lowStock: { lastUnitMessage: e.target.value } } })}
                className="input text-sm"
              />
            </Field>
          </>
        )}
      </div>

      <div className="border-t border-brand-line pt-4 space-y-2">
        <p className="text-xs font-medium text-brand-ink">Productos relacionados</p>
        <Field label="Título para productos similares">
          <input value={d.relatedTitles.alternative} onChange={(e) => patch({ productDetail: { relatedTitles: { alternative: e.target.value } } })} className="input text-sm" />
        </Field>
        <Field label="Título para productos complementarios">
          <input value={d.relatedTitles.complementary} onChange={(e) => patch({ productDetail: { relatedTitles: { complementary: e.target.value } } })} className="input text-sm" />
        </Field>
      </div>

      <div className="border-t border-brand-line pt-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-brand-ink">Información de compra</p>
          <p className="text-[11px] text-brand-ink-soft">Hasta 3 bloques debajo del formulario de producto — ej. cambios y devoluciones, compra protegida.</p>
        </div>
        {d.purchaseInfo.map((item, i) => (
          <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
            <Checkbox
              label={`Mostrar información ${i + 1}`}
              checked={item.show}
              onChange={(v) => {
                const next = d.purchaseInfo.map((it, idx) => (idx === i ? { ...it, show: v } : it));
                patch({ productDetail: { purchaseInfo: next } });
              }}
            />
            {item.show && (
              <>
                <Field label="Ícono">
                  <select
                    value={item.icon}
                    onChange={(e) => {
                      const next = d.purchaseInfo.map((it, idx) => (idx === i ? { ...it, icon: e.target.value } : it));
                      patch({ productDetail: { purchaseInfo: next } });
                    }}
                    className="input text-sm"
                  >
                    {TRUST_ICON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.emoji ? `${o.emoji} ` : ""}{o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Título">
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const next = d.purchaseInfo.map((it, idx) => (idx === i ? { ...it, title: e.target.value } : it));
                      patch({ productDetail: { purchaseInfo: next } });
                    }}
                    className="input text-sm"
                  />
                </Field>
                <Field label="Descripción">
                  <input
                    value={item.description}
                    onChange={(e) => {
                      const next = d.purchaseInfo.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it));
                      patch({ productDetail: { purchaseInfo: next } });
                    }}
                    className="input text-sm"
                  />
                </Field>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Carrito
// ----------------------------------------------------------------------------

export function CartSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const c = theme.cart;
  return (
    <div className="space-y-4 max-w-sm">
      <Checkbox label='Mostrar el botón "Ver más productos"' checked={c.showViewMoreButton} onChange={(v) => patch({ cart: { showViewMoreButton: v } })} />

      <Field label="Monto mínimo de compra" hint="¿Cuál es el monto mínimo que tus clientes deben gastar?">
        <input
          type="number"
          min="0"
          value={c.minPurchaseAmount ?? ""}
          onChange={(e) => patch({ cart: { minPurchaseAmount: e.target.value === "" ? null : Number(e.target.value) } })}
          placeholder="Sin mínimo"
          className="input text-sm"
        />
      </Field>

      <div className="border-t border-brand-line pt-4 space-y-2">
        <p className="text-xs font-medium text-brand-ink">Carrito de compras rápidas</p>
        <Checkbox
          label="Permitir agregar productos sin ir a otra página"
          checked={c.quickCart.enabled}
          onChange={(v) => patch({ cart: { quickCart: { enabled: v } } })}
        />
        {c.quickCart.enabled && (
          <Field label="Acción al agregar un producto al carrito">
            <select
              value={c.quickCart.actionOnAdd}
              onChange={(e) => patch({ cart: { quickCart: { actionOnAdd: e.target.value } } })}
              className="input text-sm"
            >
              <option value="notification">Mostrar una notificación</option>
              <option value="openCart">Abrir el carrito</option>
            </select>
          </Field>
        )}
      </div>

      <Checkbox label="Sugerir productos complementarios" checked={c.suggestComplementary} onChange={(v) => patch({ cart: { suggestComplementary: v } })} />
      <Checkbox label="Permitir aplicar cupón de descuento en el carrito" checked={c.allowCoupon} onChange={(v) => patch({ cart: { allowCoupon: v } })} />
      <Checkbox label="Mostrar calculadora de costos de envío en el carrito" checked={c.shippingCalculator} onChange={(v) => patch({ cart: { shippingCalculator: v } })} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Navegador móvil
// ----------------------------------------------------------------------------

export function MobileNavSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const n = theme.mobileNav;
  function updateItem(i: number, item: Partial<ThemeConfig["mobileNav"]["items"][number]>) {
    patch({
      mobileNav: {
        items: n.items.map((it, idx) => (idx === i ? { ...it, ...item } : it)),
      },
    });
  }
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-xs text-brand-ink-soft">
        Barra fija abajo, solo en celular — tipo app nativa. Siempre son
        estos 3 accesos; podés prenderlos/apagarlos y personalizar texto,
        link e ícono de cada uno.
      </p>
      <Checkbox label="Mostrar navegador móvil" checked={n.enabled} onChange={(v) => patch({ mobileNav: { enabled: v } })} />
      {n.enabled && (
        <div className="space-y-3">
          {n.items.map((item, i) => (
            <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
              <Checkbox label={`Ítem ${i + 1}`} checked={item.enabled} onChange={(v) => updateItem(i, { enabled: v })} />
              {item.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={item.label}
                      onChange={(e) => updateItem(i, { label: e.target.value })}
                      placeholder="Texto (ej. Inicio)"
                      className="input text-sm"
                    />
                    <input
                      value={item.url}
                      onChange={(e) => updateItem(i, { url: e.target.value })}
                      placeholder="Link (ej. /carrito)"
                      className="input text-sm"
                    />
                  </div>
                  <ImageUploadButton
                    imageUrl={item.iconUrl}
                    onChange={(url) => updateItem(i, { iconUrl: url })}
                    label="Subir ícono propio"
                    recommendedSize="Cuadrado, fondo transparente"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pop-up promocional
// ----------------------------------------------------------------------------

export function PopupSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  const p = theme.popup;
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-[11px] text-brand-ink-soft">El pop-up estará visible solo en computadoras.</p>
      <Checkbox label="Mostrar pop-up" checked={p.enabled} onChange={(v) => patch({ popup: { enabled: v } })} />
      <Field label="Imagen para el pop-up">
        <ImageUploadButton imageUrl={p.imageUrl} recommendedSize="620×320px" onChange={(url) => patch({ popup: { imageUrl: url } })} />
      </Field>
      <Field label="Frase motivadora del pop-up">
        <input value={p.phrase} onChange={(e) => patch({ popup: { phrase: e.target.value } })} className="input text-sm" />
      </Field>
      <Field label="Link (opcional)">
        <input value={p.link ?? ""} onChange={(e) => patch({ popup: { link: e.target.value || null } })} className="input text-sm" />
      </Field>
    </div>
  );
}

// ----------------------------------------------------------------------------
// CSS avanzado
// ----------------------------------------------------------------------------

export function CssSection({ theme, patch }: { theme: ThemeConfig; patch: PatchFn }) {
  return (
    <div className="space-y-2 max-w-lg">
      <p className="text-xs font-medium text-brand-ink">Para diseñadores web</p>
      <textarea
        value={theme.customCss}
        onChange={(e) => patch({ customCss: e.target.value })}
        placeholder="/* CSS */"
        spellCheck={false}
        className="w-full min-h-56 rounded-lg border border-brand-line bg-brand-ink text-white font-mono text-xs p-3"
      />
      <p className="text-[11px] text-brand-ink-soft">
        Se aplica solo en tu vitrina pública. Por seguridad no se acepta @import ni código que intente ejecutarse — solo reglas de estilo.
      </p>
    </div>
  );
}
