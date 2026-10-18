"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KNOWN_GATEWAYS } from "@/lib/payment-gateways";

/// "¿Cobras con otra pasarela?" en Pagos: la marca dice cuál y el equipo
/// de Marcolini recibe el aviso para construir la integración (ver
/// payment-gateway-request-service.ts).
export function OtherGatewayForm({ initialRequests }: { initialRequests: string[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [choice, setChoice] = useState<string>(KNOWN_GATEWAYS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const gateway = choice === "Otra" ? other.trim() : choice;

  async function send() {
    if (!gateway) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch("/api/marca/tienda/pagos/pasarelas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: [gateway], source: "MARCA" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar.");
        return;
      }
      const recorded = (body.recorded as string[]) ?? [];
      if (recorded.length === 0) {
        setError("Esa pasarela ya la tenemos o no se puede integrar fuera de su plataforma.");
        return;
      }
      setRequests((list) => Array.from(new Set([...list, ...recorded])));
      setSent(recorded[0]);
      setOther("");
      router.refresh();
    } catch {
      setError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    setBusy(true);
    try {
      await fetch("/api/marca/tienda/pagos/pasarelas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: name }),
      });
      setRequests((list) => list.filter((g) => g !== name));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">¿Cobras con otra pasarela?</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Hoy Marcolini cobra con Wompi, Mercado Pago, PayU, ePayco y Bold. Si tu pasarela es otra, cuéntanos cuál: el
        equipo recibe el aviso para construir la integración y te avisamos cuando esté lista.
      </p>
      {requests.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {requests.map((name) => (
            <li key={name} className="flex items-center gap-3">
              <span className="text-brand-ink">{name}</span>
              <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">EN LISTA</span>
              <button
                type="button"
                onClick={() => remove(name)}
                disabled={busy}
                className="text-xs text-brand-ink-soft hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Pasarela</label>
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="input text-sm w-52">
            {KNOWN_GATEWAYS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="Otra">Otra</option>
          </select>
        </div>
        {choice === "Otra" && (
          <div>
            <label className="block text-xs text-brand-ink mb-1">¿Cuál?</label>
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Nombre de la pasarela" className="input text-sm w-52" maxLength={60} />
          </div>
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy || !gateway || requests.includes(gateway)}
          className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Enviando..." : "Avisar a Marcolini"}
        </button>
      </div>
      {sent && <p className="text-xs text-brand-accent mt-2">Listo: el equipo de Marcolini ya sabe que cobras con {sent}.</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
