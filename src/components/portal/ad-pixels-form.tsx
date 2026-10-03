"use client";

import { useState } from "react";

/// Configuración → Píxeles de anuncios. La marca pega su Pixel ID (o el
/// código completo; el servidor saca el número) y su tienda queda conectada
/// a Meta / TikTok. Ver lib/ad-pixels.ts.
export function AdPixelsForm({
  initialMetaPixelId,
  initialTiktokPixelId,
  storeUrl,
}: {
  initialMetaPixelId: string;
  initialTiktokPixelId: string;
  storeUrl: string | null;
}) {
  const [meta, setMeta] = useState(initialMetaPixelId);
  const [tiktok, setTiktok] = useState(initialTiktokPixelId);
  const [saved, setSaved] = useState({ meta: initialMetaPixelId, tiktok: initialTiktokPixelId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = meta.trim() !== saved.meta || tiktok.trim() !== saved.tiktok;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch("/api/marca/tienda/pixeles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaPixelId: meta, tiktokPixelId: tiktok }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      const next = { meta: body.metaPixelId ?? "", tiktok: body.tiktokPixelId ?? "" };
      setSaved(next);
      setMeta(next.meta);
      setTiktok(next.tiktok);
      setJustSaved(true);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-2xl">
      <p className="text-sm text-brand-ink-soft">
        Pega el ID de tu pixel y tu tienda queda conectada: Meta y TikTok sabrán
        qué anuncio trajo cada visita y cada venta, y podrás hacer remarketing.
      </p>

      <PixelField
        label="Pixel de Meta (Facebook e Instagram)"
        value={meta}
        onChange={setMeta}
        active={!!saved.meta}
        placeholder="Ej. 1234567890123456"
        help="En el Administrador de eventos de Meta: Orígenes de datos → tu pixel. Es el número que aparece debajo del nombre (Identificador)."
      />

      <PixelField
        label="Pixel de TikTok"
        value={tiktok}
        onChange={setTiktok}
        active={!!saved.tiktok}
        placeholder="Ej. CABC123DEF456GHI789J0"
        help="En TikTok Ads Manager: Herramientas → Eventos → Eventos web → tu pixel. Es el código que aparece debajo del nombre (ID del pixel)."
      />

      <div className="rounded-xl border border-brand-line bg-brand-bg p-4 text-xs text-brand-ink-soft space-y-1.5">
        <p className="font-medium text-brand-ink">Qué le avisamos a tu pixel</p>
        <p>
          Visitas a tu tienda · Producto visto · Agregar al carrito · Inicio de
          pago · Compra (con el valor del pedido en COP)
        </p>
        <p>
          Puedes pegar solo el ID o el código completo que te da Meta o TikTok;
          nosotros sacamos el número.
        </p>
        {storeUrl && (
          <p>
            Para probarlo, abre{" "}
            <a href={storeUrl} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline">
              tu tienda
            </a>{" "}
            con la extensión Meta Pixel Helper o TikTok Pixel Helper de Chrome, o
            en la sección &ldquo;Probar eventos&rdquo; de cada plataforma.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {justSaved && !dirty && <span className="text-sm text-brand-accent">Guardado ✓</span>}
      </div>
    </form>
  );
}

function PixelField({
  label,
  value,
  onChange,
  active,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  active: boolean;
  placeholder: string;
  help: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-brand-ink">{label}</label>
        {active && (
          <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-brand-accent-soft text-brand-accent">
            ACTIVO
          </span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="input text-sm font-mono"
      />
      <p className="text-xs text-brand-ink-soft mt-1">{help}</p>
    </div>
  );
}
