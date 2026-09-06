"use client";

import { useState } from "react";

export type LicensableContentRow = {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK";
  contentUrl: string;
  screenshotUrl: string;
  caption: string | null;
  pricePer30Days: number;
  active: boolean;
  timesRented: number;
};

export type LicenseRow = {
  id: string;
  durationDays: number;
  creatorNetAmount: number;
  status: "APPROVED" | "PAID" | "VOIDED";
  startsAt: string;
  endsAt: string;
  content: { caption: string | null; contentUrl: string };
  brand: { companyName: string; logoUrl: string | null };
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const platformLabel: Record<LicensableContentRow["platform"], string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const licenseStatusLabel: Record<LicenseRow["status"], string> = {
  APPROVED: "Confirmada — pendiente de pago",
  PAID: "Pagada",
  VOIDED: "Anulada",
};

function NewContentForm({ onCreated }: { onCreated: (c: LicensableContentRow) => void }) {
  const [platform, setPlatform] = useState<"INSTAGRAM" | "TIKTOK">("INSTAGRAM");
  const [contentUrl, setContentUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/creador/licencias/captura", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo subir la captura.");
        return;
      }
      setScreenshotUrl(body.url);
    } catch {
      setError("No se pudo subir la captura — revisa tu conexión.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/creador/licencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, contentUrl, screenshotUrl, caption, pricePer30Days: price }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo publicar el listado.");
        return;
      }
      onCreated({
        id: body.content.id,
        platform: body.content.platform,
        contentUrl: body.content.contentUrl,
        screenshotUrl: body.content.screenshotUrl,
        caption: body.content.caption,
        pricePer30Days: Number(body.content.pricePer30Days),
        active: body.content.active,
        timesRented: 0,
      });
      setContentUrl("");
      setCaption("");
      setPrice("");
      setScreenshotUrl("");
      setOpen(false);
    } catch {
      setError("No se pudo publicar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 mb-8"
      >
        + Ofrecer un contenido
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface p-5 mb-8"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Red social</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "INSTAGRAM" | "TIKTOK")}
            className="input"
          >
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Precio por 30 días
          </label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej. 400000"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Link al post ya publicado
        </label>
        <input
          required
          type="url"
          value={contentUrl}
          onChange={(e) => setContentUrl(e.target.value)}
          placeholder="https://instagram.com/p/..."
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Descripción (opcional)
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 200))}
          placeholder="De qué se trata el video"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Captura del post
        </label>
        <p className="text-xs text-brand-ink-soft mb-2">
          Evidencia de qué contenido es y cómo se ve hoy — queda guardada por
          si hay una disputa más adelante.
        </p>
        <div className="flex items-center gap-3">
          {screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- captura subida por el creador
            <img
              src={screenshotUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-brand-line"
            />
          )}
          <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft">
            {uploading ? "Subiendo..." : screenshotUrl ? "Reemplazar" : "Subir captura"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleScreenshotChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading || !screenshotUrl}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Publicando..." : "Publicar listado"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ContentCard({
  content,
  onUpdated,
}: {
  content: LicensableContentRow;
  onUpdated: (c: LicensableContentRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [price, setPrice] = useState(String(content.pricePer30Days));

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/creador/licencias/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !content.active }),
      });
      const body = await res.json();
      if (res.ok) onUpdated({ ...content, active: body.content.active });
    } finally {
      setBusy(false);
    }
  }

  async function savePrice() {
    setBusy(true);
    try {
      const res = await fetch(`/api/creador/licencias/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePer30Days: price }),
      });
      const body = await res.json();
      if (res.ok) {
        onUpdated({ ...content, pricePer30Days: Number(body.content.pricePer30Days) });
        setEditingPrice(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- captura subida por el creador */}
      <img
        src={content.screenshotUrl}
        alt=""
        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-brand-line"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-mono text-brand-accent">
            {platformLabel[content.platform]}
          </p>
          {!content.active && (
            <span className="text-[10px] text-brand-ink-soft border border-brand-line rounded-full px-2 py-0.5">
              Fuera del catálogo
            </span>
          )}
        </div>
        <p className="text-sm text-brand-ink truncate">
          {content.caption || content.contentUrl}
        </p>
        <a
          href={content.contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Ver post →
        </a>

        <div className="flex items-center gap-3 mt-2">
          {editingPrice ? (
            <>
              <input
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input text-sm w-32"
              />
              <button
                type="button"
                onClick={savePrice}
                disabled={busy}
                className="text-xs text-brand-accent font-medium hover:underline"
              >
                Guardar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-brand-ink">
                {money(content.pricePer30Days)}{" "}
                <span className="text-xs font-normal text-brand-ink-soft">
                  / 30 días
                </span>
              </p>
              <button
                type="button"
                onClick={() => setEditingPrice(true)}
                className="text-xs text-brand-ink-soft hover:underline"
              >
                Editar precio
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-brand-ink-soft">
            {content.timesRented === 0
              ? "Sin alquilar todavía"
              : `Alquilado ${content.timesRented} ${content.timesRented === 1 ? "vez" : "veces"}`}
          </p>
          <button
            type="button"
            onClick={toggleActive}
            disabled={busy}
            className="text-xs text-brand-ink-soft hover:underline"
          >
            {content.active ? "Quitar del catálogo" : "Volver a publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreatorLicensesPanel({
  initialContent,
  initialLicenses,
}: {
  initialContent: LicensableContentRow[];
  initialLicenses: LicenseRow[];
}) {
  const [content, setContent] = useState(initialContent);

  return (
    <div>
      <NewContentForm onCreated={(c) => setContent((prev) => [c, ...prev])} />

      <h2 className="font-display font-semibold text-brand-ink mb-3">
        Tu catálogo ({content.length})
      </h2>
      {content.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-10">
          Todavía no has publicado ningún contenido para licenciar.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {content.map((c) => (
            <ContentCard
              key={c.id}
              content={c}
              onUpdated={(updated) =>
                setContent((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
            />
          ))}
        </div>
      )}

      <h2 className="font-display font-semibold text-brand-ink mb-3">
        Alquileres recibidos ({initialLicenses.length})
      </h2>
      {initialLicenses.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Ninguna marca ha alquilado tu contenido todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {initialLicenses.map((l) => (
            <div
              key={l.id}
              className="rounded-xl border border-brand-line bg-brand-surface p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-brand-ink truncate">
                  {l.brand.companyName} — {l.content.caption || l.content.contentUrl}
                </p>
                <p className="text-xs text-brand-ink-soft">
                  {l.durationDays} días · hasta{" "}
                  {new Date(l.endsAt).toLocaleDateString("es-CO")} ·{" "}
                  {licenseStatusLabel[l.status]}
                </p>
              </div>
              <p className="text-sm font-medium text-brand-accent shrink-0">
                {money(l.creatorNetAmount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
