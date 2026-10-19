"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/// Los pasos de "Lo que falta para ser visible en el marketplace" hechos
/// ahí mismo en el Dashboard, sin ir a otra sección y volver (ver
/// go-live-card.tsx y go-live-service.ts). Pedido del 2026-10-19: "¿cómo
/// podemos hacer para que hagan el paso ahí mismo?". Cada uno avisa con
/// onSaved y la tarjeta se actualiza: el paso listo desaparece.

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar — revisa tu conexión.");
  return data;
}

function money(value: string) {
  return Number(value.replace(/[^\d]/g, "") || 0);
}

function SaveButton({ busy, children, disabled }: { busy: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
      {busy ? "Guardando…" : children}
    </button>
  );
}

// ---------------------------------------------------------------- Legal

export function LegalStep({ initial, onSaved }: { initial: { legalName: string; taxId: string }; onSaved: () => void }) {
  const [legalName, setLegalName] = useState(initial.legalName);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send("/api/marca/tienda/salida/legal", "PATCH", { legalName, taxId });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
        <div>
          <label htmlFor="go-live-legal-name" className="mb-1 block text-xs text-brand-ink">
            Razón social
          </label>
          <input id="go-live-legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Como sale en el RUT" className="input text-sm" />
        </div>
        <div>
          <label htmlFor="go-live-tax-id" className="mb-1 block text-xs text-brand-ink">
            NIT
          </label>
          <input id="go-live-tax-id" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="900123456-7" inputMode="numeric" className="input text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveButton busy={busy} disabled={!legalName.trim() || !taxId.trim()}>
        Guardar
      </SaveButton>
    </form>
  );
}

// ---------------------------------------------------------------- Envíos

type Rate = {
  id: string;
  name: string;
  price: string | number;
  pendingPrice: boolean;
  condition: "NONE" | "MIN_ORDER_AMOUNT" | "MIN_WEIGHT";
  conditionValue: string | number | null;
  conditionMaxValue: string | number | null;
  conditionValueUnit: "KG" | "G";
};
type Zone = { id: string; name: string; regions: string[]; rates: Rate[] };

const num = (v: string | number | null) => (v == null ? null : Number(v));

/// Sin zonas: una para todo el país, con su precio y, si quiere, envío
/// gratis desde un monto. Con tarifas que venían como contraentrega:
/// ponerles precio.
export function ShippingStep({ onSaved }: { onSaved: () => void }) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [price, setPrice] = useState("");
  const [freeOn, setFreeOn] = useState(false);
  const [freeFrom, setFreeFrom] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marca/tienda/envios/zonas")
      .then((res) => res.json())
      .then((body) => setZones(body.zones ?? []))
      .catch(() => setZones([]));
  }, []);

  const pending = (zones ?? []).flatMap((zone) => zone.rates.filter((r) => r.pendingPrice).map((rate) => ({ zone, rate })));

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rates = [{ name: "Envío estándar", price: money(price), condition: "NONE" }];
      if (freeOn && money(freeFrom) > 0) rates.push({ name: "Envío gratis", price: 0, condition: "MIN_ORDER_AMOUNT", conditionValue: money(freeFrom) } as (typeof rates)[number]);
      await send("/api/marca/tienda/envios/zonas", "POST", { name: "Todo Colombia", regions: ["*"], rates });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  async function priceRates(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      for (const zone of zones ?? []) {
        if (!zone.rates.some((r) => r.pendingPrice)) continue;
        const rates = zone.rates.map((r) => {
          const next = r.pendingPrice ? money(prices[r.id] ?? "") : Number(r.price);
          return {
            name: r.name,
            price: next,
            pendingPrice: r.pendingPrice && next === 0,
            condition: r.condition,
            conditionValue: num(r.conditionValue),
            conditionMaxValue: num(r.conditionMaxValue),
            conditionValueUnit: r.conditionValueUnit,
          };
        });
        await send(`/api/marca/tienda/envios/zonas/${zone.id}`, "PATCH", { name: zone.name, regions: zone.regions, rates });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  if (zones === null) return <p className="text-sm text-brand-ink-soft">Un momento…</p>;

  if (pending.length > 0) {
    const missing = pending.some(({ rate }) => money(prices[rate.id] ?? "") <= 0);
    return (
      <form onSubmit={priceRates} className="space-y-3">
        <p className="text-sm text-brand-ink-soft">Estas tarifas venían como contraentrega. En Marcolini el envío se cobra en el pago: ponles precio.</p>
        <ul className="space-y-2">
          {pending.map(({ zone, rate }) => (
            <li key={rate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-surface px-3 py-2">
              <span className="min-w-0 text-sm text-brand-ink">
                {zone.name} <span className="text-brand-ink-soft">· {rate.name}</span>
              </span>
              <label className="flex items-center gap-1 text-sm text-brand-ink-soft">
                $
                <input
                  value={prices[rate.id] ?? ""}
                  onChange={(e) => setPrices((p) => ({ ...p, [rate.id]: e.target.value }))}
                  inputMode="numeric"
                  placeholder="12.000"
                  aria-label={`Precio de ${rate.name} en ${zone.name}`}
                  className="input w-28 text-sm"
                />
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton busy={busy} disabled={missing}>
            Guardar precios
          </SaveButton>
          <Link href="/marca/tienda/envios" className="text-xs text-brand-ink-soft hover:underline">
            Más opciones en Envíos
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={createZone} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="go-live-ship-price" className="mb-1 block text-xs text-brand-ink">
            Envío a todo Colombia
          </label>
          <div className="flex items-center gap-1 text-sm text-brand-ink-soft">
            $
            <input id="go-live-ship-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="12.000" className="input w-32 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-brand-ink">
          <input type="checkbox" checked={freeOn} onChange={(e) => setFreeOn(e.target.checked)} />
          Gratis desde
        </label>
        {freeOn && (
          <div className="flex items-center gap-1 pb-0.5 text-sm text-brand-ink-soft">
            $
            <input value={freeFrom} onChange={(e) => setFreeFrom(e.target.value)} inputMode="numeric" placeholder="150.000" aria-label="Envío gratis desde" className="input w-32 text-sm" />
          </div>
        )}
      </div>
      <p className="text-xs text-brand-ink-soft">
        {price.trim() && money(price) === 0 ? "Con $0 el envío es gratis siempre. " : ""}Después puedes poner precios distintos por departamento en Envíos.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveButton busy={busy} disabled={!price.trim() || (freeOn && money(freeFrom) <= 0)}>
        Guardar envío
      </SaveButton>
    </form>
  );
}

// ------------------------------------------------------------- Inventario

type NoStockProduct = { id: string; name: string; imageUrl: string | null; variants: { id: string; label: string }[] | null };

function StockInput({ label, onSave }: { label: string; onSave: (stock: number) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  async function commit() {
    if (!value.trim()) return;
    setState("saving");
    try {
      await onSave(Math.max(0, Math.floor(Number(value.replace(/[^\d]/g, "")) || 0)));
    } catch {
      setState("error");
    }
  }
  return (
    <input
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setState("idle");
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      disabled={state === "saving"}
      inputMode="numeric"
      placeholder="Unidades"
      aria-label={`Unidades de ${label}`}
      className={`input w-24 text-sm ${state === "error" ? "border-red-400" : ""}`}
    />
  );
}

/// Los productos sin control de inventario, para ponerles las unidades
/// (cada una se guarda al salir del campo y se va de la lista). Al
/// terminar con todos, el paso queda listo solo.
export function InventoryStep({ onDoneAll }: { onDoneAll: () => void }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ total: number; products: NoStockProduct[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(q: string) {
    const res = await fetch(`/api/marca/tienda/salida/inventario?q=${encodeURIComponent(q.trim())}`);
    const body = await res.json().catch(() => null);
    const next = { total: body?.total ?? 0, products: (body?.products ?? []) as NoStockProduct[] };
    setData(next);
    return next;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load(query).catch(() => setData({ total: 0, products: [] }));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function save(product: NoStockProduct, variantId: string | null, stock: number) {
    setError(null);
    try {
      await send("/api/marca/tienda/salida/inventario", "PATCH", { productId: product.id, variantId, stock });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      throw err;
    }
    const next = await load(query);
    if (next.total === 0 && !query.trim()) onDoneAll();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-brand-ink-soft">
        Escribe cuántas unidades tienes; se guarda solo.
        {data && !query.trim() && data.total > 0 ? ` Faltan ${data.total}.` : ""}
      </p>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" className="input text-sm" />
      {data === null ? (
        <p className="text-sm text-brand-ink-soft">Un momento…</p>
      ) : data.products.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">{query.trim() ? "Ningún producto sin inventario coincide." : "Todo tiene inventario."}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-brand-line overflow-y-auto rounded-lg border border-brand-line bg-brand-surface">
          {data.products.map((p) => (
            <li key={p.id} className="px-3 py-2">
              <div className="flex items-center gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-brand-line object-cover" />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-accent-soft" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm text-brand-ink">{p.name}</p>
                {!p.variants && <StockInput label={p.name} onSave={(stock) => save(p, null, stock)} />}
              </div>
              {p.variants && (
                <ul className="mt-2 space-y-1.5 pl-12">
                  {p.variants.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-xs text-brand-ink-soft">{v.label}</span>
                      <StockInput label={`${p.name} ${v.label}`} onSave={(stock) => save(p, v.id, stock)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.products.length && (
        <p className="text-xs text-brand-ink-soft">
          Ves {data.products.length} de {data.total}. Busca por nombre para encontrar los demás.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
