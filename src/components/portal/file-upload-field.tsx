"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FileUploadField({
  kind,
  label,
  hint,
  currentUrl,
}: {
  kind: "logo" | "rut" | "camara";
  label: string;
  hint?: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);

    const res = await fetch("/api/marca/perfil/subir", { method: "POST", body: form });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo subir el archivo.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      {hint && <p className="text-xs text-brand-ink-soft mb-2">{hint}</p>}
      <div className="flex items-center gap-3">
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-accent hover:underline shrink-0"
          >
            Ver archivo actual
          </a>
        )}
        <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft">
          {uploading ? "Subiendo..." : currentUrl ? "Reemplazar" : "Subir archivo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
            onChange={handleChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
