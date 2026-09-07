"use client";

import { useState } from "react";

export type PaidContentRequestRow = {
  id: string;
  briefing: string;
  feeAmount: number;
  deadlineDays: number | null;
  status: "REQUESTED" | "ACCEPTED" | "DELIVERED" | "DECLINED" | "CANCELLED" | "PAID";
  creatorNetAmount: number | null;
  deliveryUrl: string | null;
  createdAt: string;
  brand: { companyName: string; logoUrl: string | null };
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const statusLabel: Record<PaidContentRequestRow["status"], string> = {
  REQUESTED: "Pendiente de tu respuesta",
  ACCEPTED: "Aceptado — pendiente de entregar",
  DELIVERED: "Entregado — pendiente de pago",
  DECLINED: "Rechazado",
  CANCELLED: "Cancelado por la marca",
  PAID: "Pagado",
};

function DeliverForm({
  requestId,
  onDelivered,
}: {
  requestId: string;
  onDelivered: (r: { status: "DELIVERED"; deliveryUrl: string }) => void;
}) {
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/creador/encargos/captura", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo subir la captura.");
        return;
      }
      setScreenshotUrl(body.url);
    } catch {
      setError("No se pudo subir — revisa tu conexión.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/creador/encargos/${requestId}/entregar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryUrl, deliveryScreenshotUrl: screenshotUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo entregar.");
        return;
      }
      onDelivered({ status: "DELIVERED", deliveryUrl });
    } catch {
      setError("No se pudo entregar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-brand-bg p-3 mt-2 space-y-2">
      <div>
        <label className="block text-xs text-brand-ink mb-1">
          Link al contenido publicado
        </label>
        <input
          value={deliveryUrl}
          onChange={(e) => setDeliveryUrl(e.target.value)}
          placeholder="https://instagram.com/p/..."
          className="input text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        {screenshotUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- captura subida por el creador
          <img src={screenshotUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-brand-line" />
        )}
        <label className="text-xs border border-brand-line rounded-full px-4 py-1.5 cursor-pointer hover:bg-brand-accent-soft">
          {uploading ? "Subiendo..." : screenshotUrl ? "Reemplazar captura" : "Subir captura"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !deliveryUrl || !screenshotUrl}
        className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Entregando..." : "Marcar como entregado"}
      </button>
    </div>
  );
}

function RequestCard({
  request,
  onUpdated,
}: {
  request: PaidContentRequestRow;
  onUpdated: (r: PaidContentRequestRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);

  async function respond(decision: "ACCEPT" | "DECLINE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/creador/encargos/${request.id}/responder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo procesar.");
        return;
      }
      onUpdated({ ...request, status: decision === "ACCEPT" ? "ACCEPTED" : "DECLINED" });
    } catch {
      setError("No se pudo procesar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-brand-ink">
            {request.brand.companyName}
          </p>
          <p className="text-xs text-brand-ink-soft">
            {new Date(request.createdAt).toLocaleDateString("es-CO")}
            {request.deadlineDays ? ` · ${request.deadlineDays} días para entregar` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm text-brand-ink">{money(request.feeAmount)}</p>
          <p className="text-[11px] text-brand-ink-soft">{statusLabel[request.status]}</p>
        </div>
      </div>
      <p className="text-sm text-brand-ink-soft mb-2">{request.briefing}</p>

      {request.status === "REQUESTED" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => respond("ACCEPT")}
            disabled={busy}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => respond("DECLINE")}
            disabled={busy}
            className="border border-brand-line rounded-full px-4 py-1.5 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}

      {request.status === "ACCEPTED" &&
        (delivering ? (
          <DeliverForm
            requestId={request.id}
            onDelivered={(r) => onUpdated({ ...request, ...r })}
          />
        ) : (
          <button
            type="button"
            onClick={() => setDelivering(true)}
            className="text-xs text-brand-accent font-medium hover:underline"
          >
            Entregar contenido
          </button>
        ))}

      {request.status === "DELIVERED" && request.deliveryUrl && (
        <a href={request.deliveryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent hover:underline">
          Ver lo que entregaste →
        </a>
      )}
      {request.status === "PAID" && request.creatorNetAmount != null && (
        <p className="text-xs text-brand-accent">
          Te pagaron {money(request.creatorNetAmount)}.
        </p>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function CreatorPaidContentPanel({
  initialRequests,
}: {
  initialRequests: PaidContentRequestRow[];
}) {
  const [requests, setRequests] = useState(initialRequests);

  if (requests.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Ninguna marca te ha encargado contenido todavía.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          onUpdated={(updated) =>
            setRequests((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          }
        />
      ))}
    </div>
  );
}
