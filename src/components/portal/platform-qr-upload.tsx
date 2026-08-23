"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlatformQrUpload({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-3 max-w-md">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen subida directamente, sin dominio configurado para next/image
        <img src={url} alt="QR de pago actual" className="w-32 h-32 rounded-lg border border-brand-line" />
      )}
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleChange} disabled={uploading} className="block text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
