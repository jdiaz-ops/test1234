"use client";

import { useState } from "react";
import { PriceInput } from "@/components/portal/price-input";
import { COLOMBIA_REGIONS, REST_OF_COUNTRY } from "@/lib/colombia-regions";

export type ShippingZoneRow = {
  id: string;
  name: string;
  regions: string[];
  price: number;
  freeShippingThreshold: number | null;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function regionsLabel(regions: string[]) {
  if (regions.includes(REST_OF_COUNTRY)) return "Resto de Colombia";
  if (regions.length <= 3) return regions.join(", ");
  return `${regions.slice(0, 3).join(", ")} y ${regions.length - 3} más`;
}

function ZoneForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: ShippingZoneRow;
  onSaved: (zone: ShippingZoneRow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [regions, setRegions] = useState<string[]>(initial?.regions ?? []);
  const [price, setPrice] = useState<number | null>(initial?.price ?? null);
  const [freeThreshold, setFreeThreshold] = useState<number | null>(
    initial?.freeShippingThreshold ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCatchAll = regions.includes(REST_OF_COUNTRY);

  function toggleRegion(region: string) {
    setRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  function toggleCatchAll() {
    setRegions((prev) => (prev.includes(REST_OF_COUNTRY) ? [] : [REST_OF_COUNTRY]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (price == null) {
      setError("Ingresa el costo de envío.");
      return;
    }
    if (regions.length === 0) {
      setError("Elige al menos una región.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        initial
          ? `/api/marca/tienda/envios/zonas/${initial.id}`
          : "/api/marca/tienda/envios/zonas",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, regions, price, freeShippingThreshold: freeThreshold }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar la zona.");
        return;
      }
      onSaved(body.zone);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-3"
    >
      <div>
        <label className="block text-xs text-brand-ink mb-1">Nombre de la zona</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Bogotá, Fuera de Bogotá, Resto de Colombia"
          className="input text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-brand-ink mb-1">Regiones</label>
        <label className="flex items-center gap-2 text-xs text-brand-ink mb-2">
          <input type="checkbox" checked={isCatchAll} onChange={toggleCatchAll} />
          Resto de Colombia (todo lo que no cubran tus otras zonas)
        </label>
        {!isCatchAll && (
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-brand-line bg-brand-surface p-2">
            {COLOMBIA_REGIONS.map((region) => {
              const active = regions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={`text-[11px] rounded-full px-2.5 py-1 border ${
                    active
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
                  }`}
                >
                  {region}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Costo de envío</label>
          <PriceInput required value={price} onChange={setPrice} />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Envío gratis desde (opcional)
          </label>
          <PriceInput value={freeThreshold} onChange={setFreeThreshold} />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar zona"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function StoreShippingZonesPanel({
  initialZones,
}: {
  initialZones: ShippingZoneRow[];
}) {
  const [zones, setZones] = useState(initialZones);
  const [mode, setMode] = useState<
    { kind: "list" } | { kind: "create" } | { kind: "edit"; zone: ShippingZoneRow }
  >({ kind: "list" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta zona de envío?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/marca/tienda/envios/zonas/${id}`, {
        method: "DELETE",
      });
      if (res.ok) setZones((prev) => prev.filter((z) => z.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">Zonas de envío</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Cobra distinto según a dónde va el pedido. Si no creas ninguna zona,
        se usa la tarifa única de arriba para todo el país.
      </p>

      {zones.length > 0 && (
        <div className="space-y-2 mb-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-ink truncate">{zone.name}</p>
                <p className="text-xs text-brand-ink-soft">
                  {regionsLabel(zone.regions)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-mono text-sm text-brand-ink">
                    {formatCOP(zone.price)}
                  </p>
                  {zone.freeShippingThreshold != null && (
                    <p className="text-[11px] text-brand-ink-soft">
                      Gratis desde {formatCOP(zone.freeShippingThreshold)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMode({ kind: "edit", zone })}
                  className="text-xs text-brand-accent hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(zone.id)}
                  disabled={deletingId === zone.id}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode.kind === "create" && (
        <div className="mb-4">
          <ZoneForm
            onSaved={(zone) => {
              setZones((prev) => [...prev, zone]);
              setMode({ kind: "list" });
            }}
            onCancel={() => setMode({ kind: "list" })}
          />
        </div>
      )}
      {mode.kind === "edit" && (
        <div className="mb-4">
          <ZoneForm
            initial={mode.zone}
            onSaved={(zone) => {
              setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
              setMode({ kind: "list" });
            }}
            onCancel={() => setMode({ kind: "list" })}
          />
        </div>
      )}

      {mode.kind === "list" && (
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          + Agregar zona
        </button>
      )}
    </div>
  );
}
