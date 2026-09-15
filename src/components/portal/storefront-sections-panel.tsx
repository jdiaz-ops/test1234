"use client";

import { useEffect, useState } from "react";
import {
  SECTION_TYPES,
  SECTION_TYPE_LABEL,
  SECTION_TYPE_DESCRIPTION,
  DEFAULT_SECTION_CONFIG,
  type SectionType,
  type BannerConfig,
  type FeaturedCollectionConfig,
  type TextConfig,
  type ImageCarouselConfig,
  type ShippingInfoBannersConfig,
  type CategoryBannersConfig,
  type CategoryGridConfig,
  type PromoBannersConfig,
  type FeaturedProductsConfig,
  type NewProductsConfig,
  type OnSaleProductsConfig,
  type BrandCarouselConfig,
  type VideoConfig,
  type InstagramCtaConfig,
  type ProductCatalogConfig,
} from "@/lib/storefront-sections";
import { TRUST_ICON_OPTIONS } from "@/lib/brand-theme";

export type StorefrontSectionRow = {
  id: string;
  type: SectionType;
  enabled: boolean;
  config: unknown;
};

type CollectionOption = { id: string; name: string };
type ProductOption = { id: string; name: string; imageUrl: string | null; price: number };

async function patchSection(id: string, body: unknown) {
  const res = await fetch(`/api/marca/tienda/secciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/// Compartido por todos los campos de imagen de este panel — mismo
/// endpoint que usa el resto del portal.
async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/marca/tienda/productos/imagen", { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  return res.ok && body?.url ? body.url : null;
}

function ImagePicker({
  imageUrl,
  onChange,
  small,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  small?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  async function handle(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) onChange(url);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className={`${small ? "w-10 h-10" : "w-24 h-14"} rounded-lg object-cover border border-brand-line`} />
      ) : (
        <div className={`${small ? "w-10 h-10" : "w-24 h-14"} rounded-lg bg-brand-bg border border-dashed border-brand-line`} />
      )}
      <label className="text-xs border border-brand-line rounded-full px-3 py-1.5 hover:bg-brand-accent-soft cursor-pointer">
        {uploading ? "Subiendo..." : imageUrl ? "Cambiar" : "Subir imagen"}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handle(e.target.files?.[0])} disabled={uploading} className="hidden" />
      </label>
      {imageUrl && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline">
          Quitar
        </button>
      )}
    </div>
  );
}

function BannerFields({ config, onChange }: { config: BannerConfig; onChange: (next: BannerConfig) => void }) {
  function updateSlideImage(i: number, url: string | null) {
    // El "Quitar" del ImagePicker manda null — sin imagen no tiene
    // sentido guardar el slide, así que se quita la fila entera.
    if (!url) {
      onChange({ ...config, slides: config.slides.filter((_, idx) => idx !== i) });
      return;
    }
    onChange({ ...config, slides: config.slides.map((s, idx) => (idx === i ? { ...s, imageUrl: url } : s)) });
  }
  function updateSlideLink(i: number, link: string) {
    onChange({ ...config, slides: config.slides.map((s, idx) => (idx === i ? { ...s, link } : s)) });
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={config.aspectRatio}
          onChange={(e) => onChange({ ...config, aspectRatio: e.target.value as BannerConfig["aspectRatio"] })}
          className="input text-sm max-w-40"
        >
          <option value="horizontal">Horizontal</option>
          <option value="square">Cuadrado</option>
        </select>
      </div>
      <p className="text-[11px] text-brand-ink-soft">
        Con más de una imagen se arma un carrusel deslizable — cada imagen puede llevar a su propio link al hacer clic.
      </p>
      {config.slides.map((s, i) => (
        <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
          <ImagePicker imageUrl={s.imageUrl} onChange={(url) => updateSlideImage(i, url)} small />
          <input
            value={s.link}
            onChange={(e) => updateSlideLink(i, e.target.value)}
            placeholder="Link al hacer clic en esta imagen (opcional, ej. /coleccion/verano)"
            className="input text-sm"
          />
        </div>
      ))}
      {config.slides.length < 6 && (
        <ImagePicker
          imageUrl={null}
          onChange={(url) => url && onChange({ ...config, slides: [...config.slides, { imageUrl: url, link: "" }] })}
        />
      )}
      <div className="grid sm:grid-cols-2 gap-2 pt-3 border-t border-brand-line">
        <input value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} placeholder="Título (opcional, arriba de todas las imágenes)" className="input text-sm" />
        <input value={config.subtitle} onChange={(e) => onChange({ ...config, subtitle: e.target.value })} placeholder="Subtítulo (opcional)" className="input text-sm" />
        <input value={config.buttonText} onChange={(e) => onChange({ ...config, buttonText: e.target.value })} placeholder="Texto del botón (opcional)" className="input text-sm" />
        <input value={config.buttonLink} onChange={(e) => onChange({ ...config, buttonLink: e.target.value })} placeholder="Link del botón (ej. /mi-producto)" className="input text-sm" />
      </div>
    </div>
  );
}

function FeaturedCollectionFields({
  config,
  onChange,
  collections,
}: {
  config: FeaturedCollectionConfig;
  onChange: (next: FeaturedCollectionConfig) => void;
  collections: CollectionOption[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <select value={config.collectionId ?? ""} onChange={(e) => onChange({ ...config, collectionId: e.target.value || null })} className="input text-sm">
        <option value="">Elige una colección</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} placeholder="Título de la sección (opcional)" className="input text-sm" />
    </div>
  );
}

function TextFields({ config, onChange }: { config: TextConfig; onChange: (next: TextConfig) => void }) {
  return (
    <div className="space-y-2">
      <input value={config.heading} onChange={(e) => onChange({ ...config, heading: e.target.value })} placeholder="Título" className="input text-sm" />
      <textarea value={config.body} onChange={(e) => onChange({ ...config, body: e.target.value.slice(0, 2000) })} placeholder="Texto" className="input text-sm min-h-20" />
    </div>
  );
}

function ImageCarouselFields({ config, onChange }: { config: ImageCarouselConfig; onChange: (next: ImageCarouselConfig) => void }) {
  return (
    <div className="space-y-2">
      {config.images.map((url, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-16 h-10 rounded-lg object-cover border border-brand-line" />
          <button type="button" onClick={() => onChange({ images: config.images.filter((_, idx) => idx !== i) })} className="text-xs text-red-600 hover:underline">
            Quitar
          </button>
        </div>
      ))}
      {config.images.length < 8 && (
        <ImagePicker imageUrl={null} onChange={(url) => url && onChange({ images: [...config.images, url] })} />
      )}
    </div>
  );
}

function ShippingInfoBannersFields({ config, onChange }: { config: ShippingInfoBannersConfig; onChange: (next: ShippingInfoBannersConfig) => void }) {
  function updateItem(i: number, patch: Partial<ShippingInfoBannersConfig["items"][number]>) {
    onChange({ items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  return (
    <div className="space-y-3">
      {config.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-brand-ink">
            <input type="checkbox" checked={item.show} onChange={(e) => updateItem(i, { show: e.target.checked })} />
            Banner {i + 1}
          </label>
          {item.show && (
            <>
              <ImagePicker imageUrl={item.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} small />
              <div className="grid sm:grid-cols-2 gap-2">
                <select value={item.icon} onChange={(e) => updateItem(i, { icon: e.target.value })} className="input text-sm">
                  {TRUST_ICON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.emoji ? `${o.emoji} ` : ""}{o.label}
                    </option>
                  ))}
                </select>
                <input value={item.title} onChange={(e) => updateItem(i, { title: e.target.value })} placeholder="Título" className="input text-sm" />
                <input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Descripción" className="input text-sm" />
                <input value={item.link} onChange={(e) => updateItem(i, { link: e.target.value })} placeholder="Link (opcional)" className="input text-sm" />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryBannersFields({
  config,
  onChange,
  collections,
}: {
  config: CategoryBannersConfig;
  onChange: (next: CategoryBannersConfig) => void;
  collections: CollectionOption[];
}) {
  function updateItem(i: number, patch: Partial<CategoryBannersConfig["items"][number]>) {
    onChange({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-brand-ink-soft">Los banners se muestran de izquierda a derecha en computadoras y de arriba hacia abajo en celulares.</p>
      <label className="flex items-center gap-2 text-xs text-brand-ink">
        <input type="checkbox" checked={config.extendFullWidth} onChange={(e) => onChange({ ...config, extendFullWidth: e.target.checked })} />
        Extender al ancho de la pantalla
      </label>
      {config.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-brand-ink">
            <input type="checkbox" checked={item.show} onChange={(e) => updateItem(i, { show: e.target.checked })} />
            Categoría {i + 1}
          </label>
          {item.show && (
            <>
              <select value={item.collectionId ?? ""} onChange={(e) => updateItem(i, { collectionId: e.target.value || null })} className="input text-sm">
                <option value="">Elige una colección</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ImagePicker imageUrl={item.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} small />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryGridFields({
  config,
  onChange,
  collections,
}: {
  config: CategoryGridConfig;
  onChange: (next: CategoryGridConfig) => void;
  collections: CollectionOption[];
}) {
  function updateItem(i: number, patch: Partial<CategoryGridConfig["items"][number]>) {
    onChange({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  return (
    <div className="space-y-3">
      <input
        value={config.title}
        onChange={(e) => onChange({ ...config, title: e.target.value })}
        placeholder="Título (opcional, ej. Compra por categoría)"
        className="input text-sm"
      />
      <input
        value={config.subtitle}
        onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
        placeholder="Bajada (opcional, un párrafo corto)"
        className="input text-sm"
      />
      <p className="text-[11px] text-brand-ink-soft">Se muestran en cuadrícula — hasta 6, no hace falta llenarlas todas.</p>
      {config.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-brand-ink">
            <input type="checkbox" checked={item.show} onChange={(e) => updateItem(i, { show: e.target.checked })} />
            Categoría {i + 1}
          </label>
          {item.show && (
            <>
              <select value={item.collectionId ?? ""} onChange={(e) => updateItem(i, { collectionId: e.target.value || null })} className="input text-sm">
                <option value="">Elige una colección</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={item.label}
                onChange={(e) => updateItem(i, { label: e.target.value })}
                placeholder="Nombre a mostrar (vacío = usa el de la colección)"
                className="input text-sm"
              />
              <ImagePicker imageUrl={item.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} small />
              <p className="text-[11px] text-brand-ink-soft">
                Sin subir nada acá, usa la foto de la colección elegida
                (la que le pusiste en Colecciones). Sin ninguna de las
                dos, queda un ícono.
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function PromoBannersFields({ config, onChange }: { config: PromoBannersConfig; onChange: (next: PromoBannersConfig) => void }) {
  function updateItem(i: number, patch: Partial<PromoBannersConfig["items"][number]>) {
    onChange({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-brand-ink-soft">Los banners se muestran de izquierda a derecha en computadoras y de arriba hacia abajo en celulares.</p>
      <label className="flex items-center gap-2 text-xs text-brand-ink">
        <input type="checkbox" checked={config.extendFullWidth} onChange={(e) => onChange({ ...config, extendFullWidth: e.target.checked })} />
        Extender al ancho de la pantalla
      </label>
      {config.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-brand-line p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-brand-ink">
            <input type="checkbox" checked={item.show} onChange={(e) => updateItem(i, { show: e.target.checked })} />
            Promoción {i + 1}
          </label>
          {item.show && (
            <>
              <ImagePicker imageUrl={item.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} small />
              <input value={item.link} onChange={(e) => updateItem(i, { link: e.target.value })} placeholder="Link (ej. /coleccion/verano)" className="input text-sm" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ProductGroupFields({
  title,
  display,
  onTitleChange,
  onDisplayChange,
}: {
  title: string;
  display: "grid" | "carousel";
  onTitleChange: (v: string) => void;
  onDisplayChange: (v: "grid" | "carousel") => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <select value={display} onChange={(e) => onDisplayChange(e.target.value as "grid" | "carousel")} className="input text-sm">
        <option value="grid">Grilla</option>
        <option value="carousel">Carrusel</option>
      </select>
      <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Título" className="input text-sm" />
    </div>
  );
}

function FeaturedProductsFields({
  config,
  onChange,
  products,
}: {
  config: FeaturedProductsConfig;
  onChange: (next: FeaturedProductsConfig) => void;
  products: ProductOption[];
}) {
  function toggleProduct(id: string) {
    const has = config.productIds.includes(id);
    onChange({
      ...config,
      productIds: has ? config.productIds.filter((p) => p !== id) : [...config.productIds, id],
    });
  }
  return (
    <div className="space-y-3">
      <ProductGroupFields
        title={config.title}
        display={config.display}
        onTitleChange={(v) => onChange({ ...config, title: v })}
        onDisplayChange={(v) => onChange({ ...config, display: v })}
      />
      <p className="text-xs text-brand-ink-soft">Elige cuáles destacar:</p>
      <div className="max-h-56 overflow-y-auto divide-y divide-brand-line rounded-lg border border-brand-line">
        {products.length === 0 ? (
          <p className="text-xs text-brand-ink-soft p-3">No tienes productos todavía.</p>
        ) : (
          products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-bg cursor-pointer">
              <input type="checkbox" checked={config.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-brand-bg shrink-0" />
              )}
              <span className="truncate flex-1">{p.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function NewProductsFields({ config, onChange }: { config: NewProductsConfig; onChange: (next: NewProductsConfig) => void }) {
  return (
    <ProductGroupFields
      title={config.title}
      display={config.display}
      onTitleChange={(v) => onChange({ ...config, title: v })}
      onDisplayChange={(v) => onChange({ ...config, display: v })}
    />
  );
}

function OnSaleProductsFields({ config, onChange }: { config: OnSaleProductsConfig; onChange: (next: OnSaleProductsConfig) => void }) {
  return (
    <ProductGroupFields
      title={config.title}
      display={config.display}
      onTitleChange={(v) => onChange({ ...config, title: v })}
      onDisplayChange={(v) => onChange({ ...config, display: v })}
    />
  );
}

function BrandCarouselFields({ config, onChange }: { config: BrandCarouselConfig; onChange: (next: BrandCarouselConfig) => void }) {
  function updateItem(i: number, patch: Partial<BrandCarouselConfig["items"][number]>) {
    onChange({ items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  return (
    <div className="space-y-2">
      {config.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-contain border border-brand-line" />
          <input
            value={item.link ?? ""}
            onChange={(e) => updateItem(i, { link: e.target.value })}
            placeholder="Link (opcional)"
            className="input text-sm flex-1"
          />
          <button type="button" onClick={() => onChange({ items: config.items.filter((_, idx) => idx !== i) })} className="text-xs text-red-600 hover:underline shrink-0">
            Quitar
          </button>
        </div>
      ))}
      {config.items.length < 12 && (
        <ImagePicker imageUrl={null} onChange={(url) => url && onChange({ items: [...config.items, { imageUrl: url, link: "" }] })} small />
      )}
    </div>
  );
}

function VideoFields({ config, onChange }: { config: VideoConfig; onChange: (next: VideoConfig) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <input value={config.url} onChange={(e) => onChange({ ...config, url: e.target.value })} placeholder="Link de YouTube o Vimeo" className="input text-sm" />
      <input value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} placeholder="Título (opcional)" className="input text-sm" />
    </div>
  );
}

function InstagramCtaFields({ config, onChange }: { config: InstagramCtaConfig; onChange: (next: InstagramCtaConfig) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-brand-ink-soft">
        Usa tu Instagram de Configuración → Perfil — si no lo llenaste ahí, esta sección no se muestra.
      </p>
      <input value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} placeholder="Título" className="input text-sm" />
      <input value={config.description} onChange={(e) => onChange({ ...config, description: e.target.value })} placeholder="Descripción (opcional)" className="input text-sm" />
    </div>
  );
}

function ProductCatalogFields({ config, onChange }: { config: ProductCatalogConfig; onChange: (next: ProductCatalogConfig) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-brand-ink-soft">
        Todos tus productos activos, en la plantilla que elegiste en Diseño
        → Plantilla — se arma solo, no hay nada más que configurar acá.
      </p>
      <input value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} placeholder="Título (opcional)" className="input text-sm" />
    </div>
  );
}

function SectionCard({
  section,
  collections,
  products,
  onUpdated,
  onDeleted,
  onMove,
  isFirst,
  isLast,
}: {
  section: StorefrontSectionRow;
  collections: CollectionOption[];
  products: ProductOption[];
  onUpdated: (s: StorefrontSectionRow) => void;
  onDeleted: () => void;
  onMove: (dir: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [config, setConfig] = useState(section.config as Record<string, unknown>);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveConfig(next: Record<string, unknown>) {
    setConfig(next);
    setSaving(true);
    const ok = await patchSection(section.id, { config: next });
    setSaving(false);
    if (ok) onUpdated({ ...section, config: next });
  }

  async function toggleEnabled() {
    const ok = await patchSection(section.id, { enabled: !section.enabled });
    if (ok) onUpdated({ ...section, enabled: !section.enabled });
  }

  async function handleDelete() {
    if (!window.confirm("¿Quitar esta sección de tu vitrina?")) return;
    setDeleting(true);
    const res = await fetch(`/api/marca/tienda/secciones/${section.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <button type="button" onClick={() => onMove("up")} disabled={isFirst} className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none" aria-label="Subir">
              ▲
            </button>
            <button type="button" onClick={() => onMove("down")} disabled={isLast} className="text-brand-ink-soft hover:text-brand-ink disabled:opacity-20 text-xs leading-none" aria-label="Bajar">
              ▼
            </button>
          </div>
          <span className="text-sm font-medium text-brand-ink">{SECTION_TYPE_LABEL[section.type]}</span>
          {saving && <span className="text-[10px] text-brand-ink-soft">guardando...</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-brand-ink-soft">
            <input type="checkbox" checked={section.enabled} onChange={toggleEnabled} />
            Visible
          </label>
          <button type="button" onClick={handleDelete} disabled={deleting} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            {deleting ? "..." : "Quitar"}
          </button>
        </div>
      </div>

      {section.type === "BANNER" && <BannerFields config={config as unknown as BannerConfig} onChange={saveConfig} />}
      {section.type === "FEATURED_COLLECTION" && (
        <FeaturedCollectionFields config={config as unknown as FeaturedCollectionConfig} onChange={saveConfig} collections={collections} />
      )}
      {section.type === "TEXT" && <TextFields config={config as unknown as TextConfig} onChange={saveConfig} />}
      {section.type === "IMAGE_CAROUSEL" && <ImageCarouselFields config={config as unknown as ImageCarouselConfig} onChange={saveConfig} />}
      {section.type === "SHIPPING_INFO_BANNERS" && (
        <ShippingInfoBannersFields config={config as unknown as ShippingInfoBannersConfig} onChange={saveConfig} />
      )}
      {section.type === "CATEGORY_BANNERS" && (
        <CategoryBannersFields config={config as unknown as CategoryBannersConfig} onChange={saveConfig} collections={collections} />
      )}
      {section.type === "CATEGORY_GRID" && (
        <CategoryGridFields config={config as unknown as CategoryGridConfig} onChange={saveConfig} collections={collections} />
      )}
      {section.type === "PROMO_BANNERS" && <PromoBannersFields config={config as unknown as PromoBannersConfig} onChange={saveConfig} />}
      {section.type === "FEATURED_PRODUCTS" && (
        <FeaturedProductsFields config={config as unknown as FeaturedProductsConfig} onChange={saveConfig} products={products} />
      )}
      {section.type === "NEW_PRODUCTS" && <NewProductsFields config={config as unknown as NewProductsConfig} onChange={saveConfig} />}
      {section.type === "ON_SALE_PRODUCTS" && <OnSaleProductsFields config={config as unknown as OnSaleProductsConfig} onChange={saveConfig} />}
      {section.type === "BRAND_CAROUSEL" && <BrandCarouselFields config={config as unknown as BrandCarouselConfig} onChange={saveConfig} />}
      {section.type === "VIDEO" && <VideoFields config={config as unknown as VideoConfig} onChange={saveConfig} />}
      {section.type === "INSTAGRAM_CTA" && <InstagramCtaFields config={config as unknown as InstagramCtaConfig} onChange={saveConfig} />}
      {section.type === "PRODUCT_CATALOG" && (
        <ProductCatalogFields config={config as unknown as ProductCatalogConfig} onChange={saveConfig} />
      )}
    </div>
  );
}

export function StorefrontSectionsPanel({ initialSections }: { initialSections: StorefrontSectionRow[] }) {
  const [sections, setSections] = useState(initialSections);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marca/tienda/colecciones")
      .then((r) => r.json())
      .then((body) =>
        setCollections((body.collections ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => {});
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) =>
        setProducts(
          (body.products ?? []).map((p: { id: string; name: string; imageUrl: string | null; price: number }) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            price: Number(p.price),
          })),
        ),
      )
      .catch(() => {});
  }, []);

  async function addSection(type: SectionType) {
    setAdding(false);
    setError(null);
    const res = await fetch("/api/marca/tienda/secciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, config: DEFAULT_SECTION_CONFIG[type] }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "No se pudo agregar la sección.");
      return;
    }
    setSections((prev) => [...prev, body.section]);
  }

  async function move(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    await fetch("/api/marca/tienda/secciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s) => s.id) }),
    });
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <p className="text-sm font-medium text-brand-ink mb-1">Secciones de tu página de inicio</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Arma tu página con secciones ya diseñadas — prende, apaga, reordena y
        llena el contenido, sin tocar código. Este es el único lugar para
        agregar o quitar elementos de tu página de inicio, incluido tu
        catálogo de productos (sección &quot;Catálogo de productos&quot;).
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {sections.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-4">Todavía no agregas ninguna sección.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {sections.map((s, i) => (
            <SectionCard
              key={s.id}
              section={s}
              collections={collections}
              products={products}
              isFirst={i === 0}
              isLast={i === sections.length - 1}
              onMove={(dir) => move(i, dir)}
              onUpdated={(updated) => setSections((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
              onDeleted={() => setSections((prev) => prev.filter((p) => p.id !== s.id))}
            />
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border border-brand-line p-3 space-y-2 max-h-96 overflow-y-auto">
          <p className="text-xs text-brand-ink-soft mb-1">Elige un tipo de sección:</p>
          {SECTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addSection(t)}
              className="w-full text-left rounded-lg border border-brand-line p-3 hover:border-brand-accent hover:bg-brand-accent-soft"
            >
              <p className="text-sm font-medium text-brand-ink">{SECTION_TYPE_LABEL[t]}</p>
              <p className="text-xs text-brand-ink-soft mt-0.5">{SECTION_TYPE_DESCRIPTION[t]}</p>
            </button>
          ))}
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-brand-ink-soft hover:underline">
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-sm text-brand-accent font-medium hover:underline">
          + Agregar sección
        </button>
      )}
    </div>
  );
}
