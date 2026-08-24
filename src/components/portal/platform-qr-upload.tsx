"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PlatformQrUpload({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/admin/configuracion/qr", { method: "POST", body: form });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo subir la imagen.");
      return;
    }

    const body = await res.json();
    setUrl(body.url);
    router.refresh();
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-4 rounded-2xl border border-brand-line bg-brand-surface p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen subida directamente, sin dominio configurado para next/image
          <img src={url} alt="QR de pago actual" className="w-24 h-24 rounded-lg border border-brand-line shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-lg border border-dashed border-brand-line shrink-0 flex items-center justify-center text-center text-[11px] text-brand-ink-soft px-1">
            Sin QR todavía
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : url ? "Cambiar imagen del QR" : "Elegir imagen del QR"}
          </button>
          <p className="text-xs text-brand-ink-soft mt-2">PNG, JPG o WEBP.</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            disabled={uploading}
            className="hidden"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
