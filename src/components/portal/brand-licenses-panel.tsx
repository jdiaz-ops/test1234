"use client";

import { useState } from "react";

export type LicenseCatalogRow = {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK";
  contentUrl: string;
  screenshotUrl: string;
  caption: string | null;
  pricePer30Days: number;
  creator: { id: string; displayName: string; photoUrl: string | null };
};

export type BrandRentalRow = {
  id: string;
  durationDays: number;
  feeAmount: number;
  status: "APPROVED" | "PAID" | "VOIDED";
  startsAt: string;
  endsAt: string;
  content: { caption: string | null; contentUrl: string };
  creator: { displayName: string; photoUrl: string | null };
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const platformLabel: Record<LicenseCatalogRow["platform"], string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const statusLabel: Record<BrandRentalRow["status"], string> = {
  APPROVED: "Confirmada — se factura en tu próximo corte",
  PAID: "Facturada",
  VOIDED: "Anulada",
};

const DURATIONS = [30, 60, 90] as const;

function CatalogCard({
  item,
  onRented,
}: {
  item: LicenseCatalogRow;
  onRented: (rental: BrandRentalRow) => void;
}) {
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fee = Math.round(item.pricePer30Days * (duration / 30));

  async function handleRent() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/licencias/alquilar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: item.id, durationDays: duration }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo alquilar.");
        return;
      }
      setDone(true);
      onRented({
        id: body.license.id,
        durationDays: duration,
        feeAmount: fee,
        status: "APPROVED",
        startsAt: new Date().toISOString(),
        endsAt: body.license.endsAt,
        content: { caption: item.caption, contentUrl: item.contentUrl },
        creator: { displayName: item.creator.displayName, photoUrl: item.creator.photoUrl },
      });
    } catch {
      setError("No se pudo alquilar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- captura subida por el creador */}
      <img
        src={item.screenshotUrl}
        alt=""
        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-brand-line"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-mono text-brand-accent">
          {platformLabel[item.platform]} · {item.creator.displayName}
        </p>
        <p className="text-sm text-brand-ink truncate">
          {item.caption || item.contentUrl}
        </p>
        <a
          href={item.contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Ver post →
        </a>

        {done ? (
          <p className="text-xs text-brand-accent font-medium mt-3">
            Licencia alquilada ✓
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex gap-2 mb-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`text-xs rounded-full px-3 py-1 border ${
                    duration === d
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "border-brand-line text-brand-ink-soft hover:bg-brand-accent-soft"
                  }`}
                >
                  {d} días
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRent}
                disabled={busy}
                className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "..." : `Alquilar por ${money(fee)}`}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function BrandLicensesPanel({
  initialCatalog,
  initialRentals,
}: {
  initialCatalog: LicenseCatalogRow[];
  initialRentals: BrandRentalRow[];
}) {
  const [rentals, setRentals] = useState(initialRentals);

  return (
    <div>
      <h2 className="font-display font-semibold text-brand-ink mb-3">
        Contenido disponible ({initialCatalog.length})
      </h2>
      {initialCatalog.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-10">
          Ninguno de tus creadores vinculados ha publicado contenido para
          licenciar todavía.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {initialCatalog.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              onRented={(rental) => setRentals((prev) => [rental, ...prev])}
            />
          ))}
        </div>
      )}

      <h2 className="font-display font-semibold text-brand-ink mb-3">
        Tus alquileres ({rentals.length})
      </h2>
      {rentals.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no has alquilado ningún contenido.
        </p>
      ) : (
        <div className="space-y-2">
          {rentals.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-brand-line bg-brand-surface p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-brand-ink truncate">
                  {r.creator.displayName} — {r.content.caption || r.content.contentUrl}
                </p>
                <p className="text-xs text-brand-ink-soft">
                  {r.durationDays} días · hasta{" "}
                  {new Date(r.endsAt).toLocaleDateString("es-CO")} ·{" "}
                  {statusLabel[r.status]}
                </p>
              </div>
              <p className="text-sm font-medium text-brand-ink shrink-0">
                {money(r.feeAmount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
