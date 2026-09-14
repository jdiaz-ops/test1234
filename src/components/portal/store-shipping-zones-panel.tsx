"use client";

import { useState } from "react";
import { PriceInput } from "@/components/portal/price-input";
import { WeightRangeInput, type WeightUnit } from "@/components/portal/weight-input";
import { COLOMBIA_REGIONS, REST_OF_COUNTRY } from "@/lib/colombia-regions";

export type ShippingRateCondition = "NONE" | "MIN_ORDER_AMOUNT" | "MIN_WEIGHT";

export type ShippingRateRow = {
  id: string;
  name: string;
  price: number;
  condition: ShippingRateCondition;
  conditionValue: number | null;
  /// Tope del rango (ej. "pesa entre 2 y 5 kg") — opcional, se puede
  /// combinar con conditionValue o usar solo (ej. "hasta $50.000").
  conditionMaxValue: number | null;
  /// Solo aplica cuando condition = MIN_WEIGHT — puramente de
  /// presentación, conditionValue/conditionMaxValue siempre van en kg
  /// (ver WeightInput).
  conditionValueUnit?: WeightUnit;
};

export type ShippingZoneRow = {
  id: string;
  name: string;
  regions: string[];
  rates: ShippingRateRow[];
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

function rateSummary(rate: ShippingRateRow) {
  const price = rate.price === 0 ? "Gratis" : formatCOP(rate.price);
  if (rate.condition === "NONE") return `${rate.name}: ${price}`;

  const hasMin = rate.conditionValue != null;
  const hasMax = rate.conditionMaxValue != null;
  const unitSuffix = rate.condition === "MIN_WEIGHT" ? " kg" : "";
  const fmt = (v: number) =>
    rate.condition === "MIN_ORDER_AMOUNT" ? formatCOP(v) : `${v}${unitSuffix}`;
  const noun = rate.condition === "MIN_ORDER_AMOUNT" ? "el pedido" : "pesa";

  let condLabel: string;
  if (hasMin && hasMax) {
    condLabel = `si ${noun} está entre ${fmt(rate.conditionValue!)} y ${fmt(rate.conditionMaxValue!)}`;
  } else if (hasMin) {
    condLabel =
      rate.condition === "MIN_ORDER_AMOUNT"
        ? `si el pedido supera ${fmt(rate.conditionValue!)}`
        : `si pesa más de ${fmt(rate.conditionValue!)}`;
  } else if (hasMax) {
    condLabel =
      rate.condition === "MIN_ORDER_AMOUNT"
        ? `si el pedido es de hasta ${fmt(rate.conditionMaxValue!)}`
        : `si pesa hasta ${fmt(rate.conditionMaxValue!)}`;
  } else {
    condLabel = "";
  }
  return `${rate.name}: ${price} ${condLabel}`.trim();
}

/// Una fila de tarifa dentro del formulario de zona — nombre + precio +
/// condición opcional (y su umbral). Ver ShippingZoneRate en el schema.
function RateRow({
  rate,
  onChange,
  onRemove,
  canRemove,
}: {
  rate: ShippingRateRow;
  onChange: (patch: Partial<ShippingRateRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          required
          value={rate.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej. Envío estándar, Envío gratis por volumen"
          className="input text-sm flex-1"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            Quitar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-brand-ink-soft mb-0.5">
            Precio (0 = gratis)
          </label>
          <PriceInput
            required
            value={rate.price}
            onChange={(price) => onChange({ price: price ?? 0 })}
          />
        </div>
        <div>
          <label className="block text-[11px] text-brand-ink-soft mb-0.5">
            Se activa
          </label>
          <select
            value={rate.condition}
            onChange={(e) =>
              onChange({
                condition: e.target.value as ShippingRateCondition,
                conditionValue: null,
                conditionMaxValue: null,
              })
            }
            className="input text-sm"
          >
            <option value="NONE">Siempre (tarifa estándar)</option>
            <option value="MIN_ORDER_AMOUNT">Según el monto del pedido</option>
            <option value="MIN_WEIGHT">Según el peso del pedido</option>
          </select>
        </div>
        {rate.condition === "MIN_ORDER_AMOUNT" && (
          <>
            <div>
              <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                Monto mínimo (opcional)
              </label>
              <PriceInput
                value={rate.conditionValue}
                onChange={(v) => onChange({ conditionValue: v })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-brand-ink-soft mb-0.5">
                Monto máximo (opcional)
              </label>
              <PriceInput
                value={rate.conditionMaxValue}
                onChange={(v) => onChange({ conditionMaxValue: v })}
              />
            </div>
          </>
        )}
        {rate.condition === "MIN_WEIGHT" && (
          <div className="col-span-2 sm:col-span-1">
            <WeightRangeInput
              minKg={rate.conditionValue}
              maxKg={rate.conditionMaxValue}
              unit={rate.conditionValueUnit ?? "KG"}
              onChangeMin={(v) => onChange({ conditionValue: v })}
              onChangeMax={(v) => onChange({ conditionMaxValue: v })}
              onChangeUnit={(unit, minKg, maxKg) =>
                onChange({
                  conditionValueUnit: unit,
                  conditionValue: minKg,
                  conditionMaxValue: maxKg,
                })
              }
            />
          </div>
        )}
      </div>
      {(rate.condition === "MIN_ORDER_AMOUNT" || rate.condition === "MIN_WEIGHT") && (
        <p className="text-[11px] text-brand-ink-soft">
          Deja el mínimo vacío para &ldquo;hasta X&rdquo;, el máximo vacío
          para &ldquo;desde X&rdquo;, o llena ambos para un rango.
        </p>
      )}
    </div>
  );
}

function emptyRate(): ShippingRateRow {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    name: "",
    price: 0,
    condition: "NONE",
    conditionValue: null,
    conditionMaxValue: null,
    conditionValueUnit: "KG",
  };
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
  const [rates, setRates] = useState<ShippingRateRow[]>(
    initial?.rates && initial.rates.length > 0
      ? initial.rates
      : [{ ...emptyRate(), name: "Envío estándar" }],
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

  function updateRate(id: string, patch: Partial<ShippingRateRow>) {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regions.length === 0) {
      setError("Elige al menos una región.");
      return;
    }
    if (rates.some((r) => !r.name.trim())) {
      setError("Ponle nombre a cada tarifa.");
      return;
    }
    if (
      rates.some(
        (r) =>
          r.condition !== "NONE" &&
          !(r.conditionValue != null && r.conditionValue > 0) &&
          !(r.conditionMaxValue != null && r.conditionMaxValue > 0),
      )
    ) {
      setError("Ingresa el umbral (mínimo y/o máximo, monto o peso) de cada tarifa condicionada.");
      return;
    }
    if (
      rates.some(
        (r) =>
          r.conditionValue != null &&
          r.conditionMaxValue != null &&
          r.conditionMaxValue <= r.conditionValue,
      )
    ) {
      setError("El máximo debe ser mayor que el mínimo en cada rango.");
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
          body: JSON.stringify({
            name,
            regions,
            rates: rates.map((r) => ({
              name: r.name,
              price: r.price,
              condition: r.condition,
              conditionValue: r.condition === "NONE" ? null : r.conditionValue,
              conditionMaxValue: r.condition === "NONE" ? null : r.conditionMaxValue,
              conditionValueUnit: r.conditionValueUnit ?? "KG",
            })),
          }),
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
      className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-4"
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

      <div>
        <label className="block text-xs text-brand-ink mb-2">
          Tarifas de esta zona
        </label>
        <div className="space-y-2">
          {rates.map((rate) => (
            <RateRow
              key={rate.id}
              rate={rate}
              onChange={(patch) => updateRate(rate.id, patch)}
              onRemove={() => setRates((prev) => prev.filter((r) => r.id !== rate.id))}
              canRemove={rates.length > 1}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRates((prev) => [...prev, emptyRate()])}
          className="text-xs text-brand-accent font-medium hover:underline mt-2"
        >
          + Agregar tarifa condicionada
        </button>
        <p className="text-[11px] text-brand-ink-soft mt-1">
          Si más de una tarifa aplica a la vez (ej. la estándar y una
          &ldquo;gratis si...&rdquo;), se cobra siempre la más barata.
        </p>
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
        Cobra distinto según a dónde va el pedido, y arma reglas
        condicionadas (por peso o por el valor del pedido) dentro de cada
        zona. Necesitas al menos una zona para poder vender productos
        físicos — puede ser una sola que cubra &ldquo;Resto de
        Colombia&rdquo;.
      </p>

      {zones.length > 0 && (
        <div className="space-y-2 mb-4">
          {zones.map((zone) => (
            <div key={zone.id} className="rounded-xl bg-brand-bg px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-ink truncate">
                    {zone.name}
                  </p>
                  <p className="text-xs text-brand-ink-soft">
                    {regionsLabel(zone.regions)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
              {zone.rates.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {zone.rates.map((rate) => (
                    <li key={rate.id} className="text-xs text-brand-ink-soft">
                      {rateSummary(rate)}
                    </li>
                  ))}
                </ul>
              )}
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
