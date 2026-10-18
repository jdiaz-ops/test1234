"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  chunkText,
  draftsToImport,
  mergeDrafts,
  type DraftOption,
  type DraftProduct,
  type PhotoBox,
  type PhotoRef,
} from "@/lib/catalog-files";
import type { ShopifyCsvParseResult } from "@/lib/shopify-csv";
import type { ShopifyImportCollection } from "@/lib/shopify-products-json";
import type { ShopifyThemeInfo } from "@/lib/shopify-theme";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import type { ExtractResult, OrganizeResult } from "@/server/services/catalog-files-reader";

const API_EXTRACT = "/api/marca/tienda/productos/leer-archivos";
const API_ORGANIZE = "/api/marca/tienda/productos/leer-archivos/organizar";
const API_EXCEL = "/api/marca/tienda/productos/leer-archivos/excel";
const API_IMAGE = "/api/marca/tienda/productos/imagen";
const READ_CONCURRENCY = 3;
const UPLOAD_CONCURRENCY = 3;
const MAX_PDF_PAGES = 60;
/// Lado largo de la página de PDF guardada (de ahí se recortan las fotos).
const PDF_RENDER_SIDE = 2000;
/// Lado largo de lo que se le manda a Claude (más grande no le sirve).
const AI_IMAGE_SIDE = 1568;

type Source = {
  id: string;
  label: string;
  blob?: Blob;
  text?: string;
};

type LoosePhoto = { id: string; sourceId: string; caption: string };

/// Lo que se le entrega al importador (shopify-importer.tsx): el mismo
/// shape que deja leer una tienda por link.
export type FilesRead = {
  parsed: ShopifyCsvParseResult;
  collections: ShopifyImportCollection[];
  theme: ShopifyThemeInfo | null;
  notes: string[];
};

let counter = 0;
const newId = (prefix: string) => `${prefix}${++counter}`;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "No pudimos completar este paso.");
  return data as T;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) await fn(items[cursor++]);
    }),
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.88) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen."))), type, quality),
  );
}

/// Recorta (box de 0 a 1000) y achica una imagen. Sin box = la imagen
/// entera.
async function cropImage(blob: Blob, box: PhotoBox | null, maxSide: number, type = "image/jpeg") {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const sx = box ? (box.x0 / 1000) * bitmap.width : 0;
  const sy = box ? (box.y0 / 1000) * bitmap.height : 0;
  const sw = box ? ((box.x1 - box.x0) / 1000) * bitmap.width : bitmap.width;
  const sh = box ? ((box.y1 - box.y0) / 1000) * bitmap.height : bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToBlob(canvas, type, 0.88);
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/// Cada página del PDF como imagen (en el navegador, con pdf.js): así
/// Claude ve las fotos y el diseño del catálogo, y de ahí se recortan las
/// fotos de cada producto.
async function pdfToPages(file: File): Promise<Source[]> {
  // Versión 4 "legacy": las 5 y 6 usan funciones de JavaScript que Safari
  // y Chrome todavía no traen, y se caen sin avisar.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: Source[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PDF_RENDER_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ id: newId("s"), label: `${file.name} · página ${n}`, blob: await canvasToBlob(canvas) });
    page.cleanup();
  }
  await task.destroy();
  return pages;
}

function formatOptions(options: DraftOption[]) {
  return options.map((o) => `${o.name}: ${o.values.join(", ")}`).join("; ");
}

function parseOptions(text: string): DraftOption[] {
  return text
    .split(";")
    .map((part) => {
      const [name, values = ""] = part.split(":");
      return { name: name.trim(), values: values.split(",").map((v) => v.trim()).filter(Boolean) };
    })
    .filter((o) => o.name && o.values.length > 0)
    .slice(0, 3);
}

/// "Duplicar tienda" → "Desde archivos": la marca sin web manda lo que
/// tenga (catálogos en PDF, fotos sueltas, pantallazos del catálogo de
/// WhatsApp o Instagram, listas de precios en Excel, mensajes copiados) y
/// Claude arma el catálogo (ver catalog-files-reader.ts). Se revisa y se
/// corrige en la tabla, y se entrega al importador, que sigue igual que
/// con el link de una tienda.
export function CatalogFilesReader({
  onRead,
  handedOff,
  onEdit,
}: {
  onRead: (read: FilesRead) => void;
  /// El importador ya tiene estos productos (se muestra resumido).
  handedOff: boolean;
  onEdit: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "uploading">("pick");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Map<string, Source>>(new Map());
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [loose, setLoose] = useState<LoosePhoto[]>([]);
  const [logoSourceId, setLogoSourceId] = useState<string | null>(null);
  const [organized, setOrganized] = useState<Pick<OrganizeResult, "storeName" | "palette"> | null>(null);
  const [social, setSocial] = useState<{ instagram: string | null; whatsapp: string | null }>({ instagram: null, whatsapp: null });
  const [notes, setNotes] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const attempted = useRef(new Set<string>());

  // Miniaturas de cada foto (recortada) para la tabla de revisión.
  useEffect(() => {
    if (phase !== "review") return;
    const refs: PhotoRef[] = [...drafts.flatMap((d) => d.photos), ...loose.map((l) => ({ id: l.id, sourceId: l.sourceId, box: null }))];
    const missing = refs.filter((r) => !attempted.current.has(r.id));
    if (missing.length === 0) return;
    for (const r of missing) attempted.current.add(r.id);
    let cancelled = false;
    (async () => {
      const next = new Map(thumbs);
      for (const ref of missing) {
        const blob = sources.get(ref.sourceId)?.blob;
        if (!blob) continue;
        try {
          next.set(ref.id, URL.createObjectURL(await cropImage(blob, ref.box, 200)));
        } catch {
          // Sin miniatura: la foto igual se puede subir.
        }
      }
      if (cancelled) {
        for (const r of missing) attempted.current.delete(r.id);
      } else {
        setThumbs(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, drafts, loose, sources, thumbs]);

  const assigned = useMemo(() => new Set(drafts.flatMap((d) => d.photos.map((p) => p.id))), [drafts]);
  const unassigned = loose.filter((l) => !assigned.has(l.id));

  async function read() {
    setError(null);
    setPhase("reading");
    const all = new Map<string, Source>();
    const readNotes: string[] = [];
    try {
      // 1. Todo a imágenes o pedazos de texto.
      for (const file of files) {
        setStep(`Preparando ${file.name}…`);
        const name = file.name.toLowerCase();
        try {
          if (file.type === "application/pdf" || name.endsWith(".pdf")) {
            const pages = await pdfToPages(file);
            for (const p of pages) all.set(p.id, p);
          } else if (file.type.startsWith("image/")) {
            const id = newId("s");
            all.set(id, { id, label: file.name, blob: file });
          } else if (name.endsWith(".xlsx")) {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch(API_EXCEL, { method: "POST", body: form });
            const body = await res.json().catch(() => null);
            if (!res.ok || !body?.ok) throw new Error(body?.error ?? "No se pudo abrir el Excel.");
            for (const [i, text] of chunkText(body.text as string).entries()) {
              const id = newId("s");
              all.set(id, { id, label: `${file.name} · parte ${i + 1}`, text });
            }
          } else {
            for (const [i, text] of chunkText(await file.text()).entries()) {
              const id = newId("s");
              all.set(id, { id, label: `${file.name} · parte ${i + 1}`, text });
            }
          }
        } catch (err) {
          readNotes.push(`${file.name}: ${err instanceof Error ? err.message : "no se pudo abrir"}`);
        }
      }
      for (const [i, text] of chunkText(pasted).entries()) {
        const id = newId("s");
        all.set(id, { id, label: `Texto pegado · parte ${i + 1}`, text });
      }
      if (all.size === 0) throw new Error("No hay nada para leer.");

      // 2. Claude lee cada pieza.
      const found: DraftProduct[] = [];
      const photos: LoosePhoto[] = [];
      const brandNames: string[] = [];
      const brandColors: string[] = [];
      let logo: string | null = null;
      let instagram: string | null = null;
      let whatsapp: string | null = null;
      let done = 0;
      const list = Array.from(all.values());
      await pool(list, READ_CONCURRENCY, async (source) => {
        try {
          let result: ExtractResult;
          if (source.blob) {
            const small = await cropImage(source.blob, null, AI_IMAGE_SIDE);
            result = await postJson<ExtractResult>(API_EXTRACT, {
              kind: "image",
              mediaType: "image/jpeg",
              base64: await blobToBase64(small),
              label: source.label,
            });
          } else {
            result = await postJson<ExtractResult>(API_EXTRACT, { kind: "text", text: source.text, label: source.label });
          }
          if (result.kind === "logo" && source.blob && !logo) logo = source.id;
          if (result.kind === "product_photo" && source.blob) {
            photos.push({ id: newId("f"), sourceId: source.id, caption: result.photoCaption || source.label });
          }
          for (const p of result.products) {
            found.push({
              id: newId("p"),
              name: p.name,
              description: p.description,
              price: p.price,
              compareAtPrice: p.compareAtPrice,
              category: p.category,
              sku: p.sku,
              weightGrams: p.weightGrams,
              options: p.options,
              photos: p.photoBox && source.blob ? [{ id: newId("f"), sourceId: source.id, box: p.photoBox }] : [],
            });
          }
          if (result.brand.name) brandNames.push(result.brand.name);
          brandColors.push(...result.brand.colors);
          instagram ||= result.brand.instagram.replace(/^@/, "") || null;
          whatsapp ||= result.brand.whatsapp.replace(/\D/g, "") || null;
        } catch (err) {
          readNotes.push(`${source.label}: ${err instanceof Error ? err.message : "no se pudo leer"}`);
        }
        done++;
        setStep(`Leyendo con IA… ${done} de ${list.length} (${found.length} productos)`);
      });

      let merged = mergeDrafts(found);
      if (merged.length === 0) throw new Error("No encontramos productos en estos archivos.");

      // 3. Ordenar categorías, unir fotos sueltas y proponer colores.
      let org: Pick<OrganizeResult, "storeName" | "palette"> | null = null;
      try {
        setStep("Organizando categorías y fotos…");
        const result = await postJson<OrganizeResult>(API_ORGANIZE, {
          products: merged.slice(0, 600).map((d) => ({ id: d.id, name: d.name.slice(0, 255), category: d.category.slice(0, 80), price: d.price })),
          photos: photos.slice(0, 300).map((p) => ({ id: p.id, caption: p.caption.slice(0, 300) })),
          brandNames: Array.from(new Set(brandNames)).slice(0, 50),
          brandColors: Array.from(new Set(brandColors)).slice(0, 60),
        });
        const categoryMap = new Map(result.categories.map((c) => [c.from.trim().toLowerCase(), c.to]));
        const photoById = new Map(photos.map((p) => [p.id, p]));
        merged = merged.map((d) => ({
          ...d,
          category: categoryMap.get(d.category.trim().toLowerCase()) ?? d.category,
          photos: [
            ...d.photos,
            ...result.photoAssignments
              .filter((a) => a.productId === d.id)
              .map((a) => photoById.get(a.photoId))
              .filter((p): p is LoosePhoto => Boolean(p))
              .map((p) => ({ id: p.id, sourceId: p.sourceId, box: null })),
          ],
        }));
        org = { storeName: result.storeName, palette: result.palette };
      } catch (err) {
        readNotes.push(`No se pudieron organizar las categorías y fotos: ${err instanceof Error ? err.message : ""}`);
      }

      setSources(all);
      setDrafts(merged);
      setLoose(photos);
      setLogoSourceId(logo);
      setOrganized(org);
      setSocial({ instagram, whatsapp });
      setNotes(readNotes);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron leer los archivos.");
      setNotes(readNotes);
      setPhase("pick");
    }
  }

  function update(id: string, patch: Partial<DraftProduct>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function uploadPhoto(ref: PhotoRef): Promise<string | null> {
    const blob = sources.get(ref.sourceId)?.blob;
    if (!blob) return null;
    try {
      const cropped = await cropImage(blob, ref.box, 2000, "image/webp");
      const file = await prepareImageForUpload(new File([cropped], "foto.webp", { type: cropped.type || "image/webp" }));
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(API_IMAGE, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      // En desarrollo local la subida devuelve una ruta (/uploads/…); el
      // importador pide URL completa.
      return res.ok && body?.url ? new URL(body.url as string, window.location.origin).toString() : null;
    } catch {
      return null;
    }
  }

  async function handOff() {
    setPhase("uploading");
    const refs = Array.from(new Map(drafts.flatMap((d) => d.photos).map((p) => [p.id, p])).values());
    const urls = new Map<string, string>();
    let done = 0;
    let failed = 0;
    await pool(refs, UPLOAD_CONCURRENCY, async (ref) => {
      const url = await uploadPhoto(ref);
      if (url) urls.set(ref.id, url);
      else failed++;
      done++;
      setStep(`Subiendo fotos a Marcolini… ${done} de ${refs.length}`);
    });
    const logoUrl = logoSourceId ? await uploadPhoto({ id: "logo", sourceId: logoSourceId, box: null }) : null;

    const { products, collections } = draftsToImport(drafts, urls);
    const stats = { products: products.length, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };
    for (const p of products) {
      stats.images += p.images.length;
      if (p.hasVariants) stats.withVariants++;
      if (p.status === "DRAFT") stats.draft++;
      if (p.hasVariants || p.stock == null) stats.unknownStock++;
    }
    const theme: ShopifyThemeInfo | null =
      logoUrl || organized?.palette || social.instagram || social.whatsapp
        ? {
            storeName: organized?.storeName || null,
            logoUrl,
            faviconUrl: null,
            colors: organized?.palette ?? null,
            fonts: null,
            menu: [],
            payments: { methods: [], gateways: [] },
            pixels: { metaPixelId: null, tiktokPixelId: null, googleAnalyticsId: null },
            social: { instagram: social.instagram, tiktok: null, facebook: null, whatsapp: social.whatsapp, email: null, phone: null },
            announcements: [],
            pageLinks: [],
            policyLinks: [],
            homeSections: [],
          }
        : null;
    const out = [...notes];
    if (failed > 0) out.push(`${failed} fotos no se pudieron subir: agrégalas desde Editar.`);
    const noWeight = products.filter((p) => !p.weight && !p.variants.some((v) => v.weight)).length;
    if (noWeight > 0) out.push(`${noWeight} productos sin peso: agrégalo desde Editar para que el envío se calcule bien.`);
    onRead({ parsed: { products, warnings: [], stats }, collections, theme, notes: out });
    setPhase("review");
  }

  if (handedOff) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-brand-line bg-brand-bg px-4 py-3 text-xs text-brand-ink-soft">
        <span>{drafts.length} productos leídos de tus archivos y revisados.</span>
        <button type="button" onClick={onEdit} className="hover:underline text-brand-ink">
          Volver a la tabla
        </button>
      </div>
    );
  }

  if (phase === "reading" || phase === "uploading") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-brand-ink">{step}</p>
        <p className="text-xs text-brand-ink-soft">No cierres esta pantalla. Un catálogo largo puede tardar unos minutos.</p>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-brand-ink-soft">
          Revisa lo que leyó la IA: corrige nombres, precios y categorías, quita fotos que no van y borra lo que no sea
          un producto. Las variantes se escriben así: <span className="font-mono">Talla: S, M, L; Color: Rojo, Azul</span>.
        </p>
        {notes.length > 0 && (
          <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
            {notes.slice(0, 8).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <div className="rounded-xl border border-brand-line overflow-hidden">
          <div className="max-h-[32rem] overflow-auto divide-y divide-brand-line">
            {drafts.map((d) => (
              <div key={d.id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {d.photos.map((p) => (
                    <div key={p.id} className="relative">
                      {thumbs.get(p.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- recorte local, aún no subido
                        <img src={thumbs.get(p.id)} alt="" className="h-14 w-14 rounded object-cover bg-brand-bg" />
                      ) : (
                        <div className="h-14 w-14 rounded bg-brand-bg" />
                      )}
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() => update(d.id, { photos: d.photos.filter((x) => x.id !== p.id) })}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-brand-ink text-white text-xs leading-5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {unassigned.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const photo = loose.find((l) => l.id === e.target.value);
                        if (photo) update(d.id, { photos: [...d.photos, { id: photo.id, sourceId: photo.sourceId, box: null }] });
                      }}
                      className="input text-xs w-auto"
                    >
                      <option value="">+ Foto suelta…</option>
                      {unassigned.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.caption.slice(0, 60)}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Borrar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                  <input
                    value={d.name}
                    onChange={(e) => update(d.id, { name: e.target.value })}
                    placeholder="Nombre"
                    className="input sm:col-span-3"
                  />
                  <input
                    value={d.price ?? ""}
                    onChange={(e) => update(d.id, { price: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
                    placeholder="Precio"
                    inputMode="numeric"
                    className="input sm:col-span-1"
                  />
                  <input
                    value={d.category}
                    onChange={(e) => update(d.id, { category: e.target.value })}
                    placeholder="Categoría"
                    className="input sm:col-span-2"
                  />
                  <input
                    defaultValue={formatOptions(d.options)}
                    onBlur={(e) => update(d.id, { options: parseOptions(e.target.value) })}
                    placeholder="Variantes (opcional)"
                    className="input sm:col-span-6 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {unassigned.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-brand-ink-soft">Fotos sin producto ({unassigned.length}) — asígnalas desde cada fila o se quedan afuera:</p>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((l) =>
                thumbs.get(l.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto local, aún no subida
                  <img key={l.id} src={thumbs.get(l.id)} alt={l.caption} title={l.caption} className="h-12 w-12 rounded object-cover" />
                ) : null,
              )}
            </div>
          </div>
        )}
        <div className="text-xs text-brand-ink-soft">
          {drafts.length} productos · {drafts.filter((d) => !d.price).length} sin precio (entran como borrador)
          {organized?.palette ? " · colores de marca propuestos" : ""}
          {logoSourceId ? " · logo encontrado" : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handOff()}
            disabled={drafts.length === 0}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Usar estos {drafts.length} productos
          </button>
          <button type="button" onClick={() => setPhase("pick")} className="text-xs text-brand-ink-soft hover:underline px-2">
            Empezar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-brand-ink-soft space-y-1.5">
        <p>
          Para marcas sin web que venden por WhatsApp. Sube todo lo que te mandó la marca, sin ordenar: catálogos en PDF,
          fotos de productos, pantallazos del catálogo de WhatsApp o Instagram, listas de precios en Excel o CSV, y el
          logo. También puedes pegar mensajes o listas de precios.
        </p>
        <p>
          La IA saca los productos (nombre, precio, descripción, variantes, categoría), recorta las fotos de los catálogos,
          une las fotos sueltas con su producto y propone los colores de la tienda. Antes de importar revisas todo en una
          tabla.
        </p>
      </div>
      <label className="block rounded-xl border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-ink-soft cursor-pointer hover:bg-brand-accent-soft">
        {files.length > 0 ? (
          <span className="text-brand-ink">{files.length} archivos elegidos</span>
        ) : (
          "Elegir archivos (PDF, fotos, Excel, CSV, texto)"
        )}
        <input
          type="file"
          multiple
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,.xlsx,.csv,.txt,text/csv,text/plain"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="hidden"
        />
      </label>
      {files.length > 0 && (
        <ul className="text-xs text-brand-ink-soft max-h-24 overflow-auto">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`}>{f.name}</li>
          ))}
        </ul>
      )}
      <textarea
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        rows={4}
        placeholder="Opcional: pega aquí mensajes de WhatsApp o listas de precios"
        className="input w-full text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notes.length > 0 && phase === "pick" && (
        <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
          {notes.slice(0, 5).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void read()}
        disabled={files.length === 0 && !pasted.trim()}
        className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
      >
        Leer con IA
      </button>
    </div>
  );
}
