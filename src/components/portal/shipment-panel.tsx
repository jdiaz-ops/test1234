"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Shipment {
  id: string;
  requestedBy: "CREATOR" | "BRAND";
  description: string;
  shippingAddress: string;
  status: "REQUESTED" | "SENT" | "DELIVERED";
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
}

const statusLabel: Record<string, string> = {
  REQUESTED: "Pedido — esperando despacho",
  SENT: "Enviado",
  DELIVERED: "Entregado",
};

function ActionUrl(role: "BRAND" | "CREATOR") {
  return role === "BRAND" ? "/api/marca/envios" : "/api/creador/envios";
}

function BrandSendForm({ enrollmentId, onDone }: { enrollmentId: string; onDone: () => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/marca/envios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", enrollmentId, description, shippingAddress, carrier, trackingNumber }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo enviar.");
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué le estás enviando" className="input" />
      <input required value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Dirección de envío" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Transportadora (opcional)" className="input" />
        <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="N° de guía (opcional)" className="input" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? "Enviando..." : "Confirmar envío"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CreatorRequestForm({ enrollmentId, onDone }: { enrollmentId: string; onDone: () => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/creador/envios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", enrollmentId, description, shippingAddress }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo enviar.");
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué producto necesitas" className="input" />
      <input required value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Tu dirección de envío" className="input" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? "Enviando..." : "Pedir producto"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function MarkSentForm({ shipmentId, onDone }: { shipmentId: string; onDone: () => void }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/marca/envios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markSent", shipmentId, carrier, trackingNumber }),
    });
    setSaving(false);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Transportadora" className="input text-xs py-1" />
      <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="N° de guía" className="input text-xs py-1" />
      <button type="submit" disabled={saving} className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50 shrink-0">
        {saving ? "..." : "Marcar despachado"}
      </button>
    </form>
  );
}

function MarkDeliveredButton({ shipmentId, role }: { shipmentId: string; role: "BRAND" | "CREATOR" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(ActionUrl(role), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markDelivered", shipmentId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading} className="text-xs text-brand-accent font-medium hover:underline mt-1">
      {loading ? "..." : "Confirmar que llegó"}
    </button>
  );
}

export function ShipmentPanel({
  enrollmentId,
  shipments,
  role,
}: {
  enrollmentId: string;
  shipments: Shipment[];
  role: "BRAND" | "CREATOR";
}) {
  const [creating, setCreating] = useState(false);
  const [markingSentId, setMarkingSentId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-brand-ink text-sm">Producto</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className="text-xs text-brand-accent font-medium hover:underline">
            {role === "BRAND" ? "+ Enviar producto" : "+ Pedir producto"}
          </button>
        )}
      </div>

      {creating &&
        (role === "BRAND" ? (
          <BrandSendForm enrollmentId={enrollmentId} onDone={() => setCreating(false)} />
        ) : (
          <CreatorRequestForm enrollmentId={enrollmentId} onDone={() => setCreating(false)} />
        ))}

      {shipments.length === 0 && !creating ? (
        <p className="text-xs text-brand-ink-soft">Sin envíos todavía.</p>
      ) : (
        <div className="space-y-3 mt-2">
          {shipments.map((s) => (
            <div key={s.id} className="text-xs border-t border-brand-line pt-2 first:border-t-0 first:pt-0">
              <p className="text-brand-ink font-medium">{s.description}</p>
              <p className="text-brand-ink-soft">{s.shippingAddress}</p>
              {(s.carrier || s.trackingNumber) && (
                <p className="text-brand-ink-soft">
                  {s.carrier} {s.trackingNumber && `· Guía ${s.trackingNumber}`}
                </p>
              )}
              <p className="font-mono text-brand-accent mt-1">{statusLabel[s.status]}</p>

              {role === "BRAND" && s.status === "REQUESTED" && (
                markingSentId === s.id ? (
                  <MarkSentForm shipmentId={s.id} onDone={() => setMarkingSentId(null)} />
                ) : (
                  <button onClick={() => setMarkingSentId(s.id)} className="text-xs text-brand-accent font-medium hover:underline mt-1">
                    Marcar como despachado
                  </button>
                )
              )}

              {s.status === "SENT" && <MarkDeliveredButton shipmentId={s.id} role={role} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
