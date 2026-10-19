"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apexOf } from "@/lib/custom-domain";

type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };

/// Lo que devuelve /api/marca/tienda/dominio/estado (ver
/// custom-domain-service.ts): si el dominio ya abre la tienda (activo), si
/// Marcolini ya lo registró en Vercel, si el DNS ya apunta y qué registros
/// poner.
type DomainStatus = {
  domain: string | null;
  verified: boolean;
  active: boolean;
  checkedAt: string | null;
  companion: string | null;
  vercel: {
    automatic: boolean;
    registered: boolean;
    verification: DnsRecord[];
    configured: boolean;
    records: DnsRecord[];
    error: string | null;
  };
};

/// null cuando no se pudo consultar.
async function fetchStatus(force: boolean): Promise<DomainStatus | null> {
  try {
    const res = await fetch(`/api/marca/tienda/dominio/estado${force ? "?revisar=1" : ""}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DomainStatus;
  } catch {
    return null;
  }
}

/// Los paneles de DNS piden el nombre sin el dominio: "_marcolini-verify"
/// o "tienda", no "_marcolini-verify.tumarca.com".
function shortName(name: string, apex: string) {
  if (name === "@" || name === apex) return "@";
  return name.endsWith(`.${apex}`) ? name.slice(0, -(apex.length + 1)) : name;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia:", value);
    }
  }
  return (
    <button type="button" onClick={copy} className="shrink-0 text-[11px] font-medium text-brand-accent hover:underline">
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function Records({ records, apex }: { records: DnsRecord[]; apex: string }) {
  return (
    <div className="space-y-2">
      {records.map((r) => {
        const name = shortName(r.name, apex);
        return (
          <div
            key={`${r.type}-${r.name}-${r.value}`}
            className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg border border-brand-line bg-white p-3 text-xs"
          >
            <span className="text-brand-ink-soft">Tipo</span>
            <span className="font-mono font-medium text-brand-ink">{r.type}</span>
            <span />
            <span className="text-brand-ink-soft">Nombre</span>
            <span className="font-mono text-brand-ink [overflow-wrap:anywhere]">{name}</span>
            <CopyButton value={name} />
            <span className="text-brand-ink-soft">Valor</span>
            <span className="font-mono text-brand-ink [overflow-wrap:anywhere]">{r.value}</span>
            <CopyButton value={r.value} />
          </div>
        );
      })}
    </div>
  );
}

/// Dónde se agregan los registros en los proveedores más comunes.
const PROVIDER_GUIDES = [
  { name: "GoDaddy", steps: "Mis productos → Dominios → tu dominio → DNS → Agregar registro nuevo." },
  { name: "Hostinger", steps: "hPanel → Dominios → tu dominio → DNS / Nameservers → Administrar registros DNS." },
  {
    name: "Cloudflare",
    steps: "Tu dominio → DNS → Records → Add record. Deja la nube en gris («Solo DNS»): con la nube naranja el candado https no sale.",
  },
  { name: "Namecheap", steps: "Domain List → Manage → Advanced DNS → Add New Record." },
  { name: "Squarespace (antes Google Domains)", steps: "Dominios → tu dominio → DNS → Registros personalizados." },
  { name: "Wix", steps: "Dominios → ⋯ junto a tu dominio → Administrar registros DNS." },
];

function ProviderGuides() {
  return (
    <details className="rounded-lg border border-brand-line bg-white p-3 text-xs">
      <summary className="cursor-pointer font-medium text-brand-ink">¿Dónde se ponen? Guía por proveedor</summary>
      <ul className="mt-2 space-y-1.5 text-brand-ink-soft">
        {PROVIDER_GUIDES.map((g) => (
          <li key={g.name}>
            <span className="font-medium text-brand-ink">{g.name}:</span> {g.steps}
          </li>
        ))}
        <li>Si ya hay un registro A o CNAME con ese mismo nombre (de Shopify, Wix u otra web), cámbialo por este: no dejes los dos.</li>
        <li>Los registros del correo (MX) no se tocan.</li>
      </ul>
    </details>
  );
}

function Chip({ tone, children }: { tone: "ok" | "wait"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
        tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {children}
    </span>
  );
}

export function CustomDomainForm({
  initialDomain,
  initialToken,
  initialVerified,
  initialActive,
  storeSubdomain,
}: {
  initialDomain: string | null;
  initialToken: string | null;
  initialVerified: boolean;
  initialActive: boolean;
  /// {slug}.marcolini.lat — donde la tienda sigue abriendo mientras tanto.
  storeSubdomain: string | null;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [savedDomain, setSavedDomain] = useState(initialDomain);
  const [token, setToken] = useState(initialToken);
  const [verified, setVerified] = useState(initialVerified);
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(next: DomainStatus | null) {
    if (next) {
      setStatus(next);
      setActive(next.active);
      setStatusFailed(false);
    } else {
      setStatusFailed(true);
    }
  }

  /// Después de verificar, el estado de la conexión (y, si todavía espera
  /// el DNS, una revisión de una).
  useEffect(() => {
    if (!verified || !savedDomain) return;
    let cancelled = false;
    void fetchStatus(false).then((next) => {
      if (cancelled) return;
      if (next) {
        setStatus(next);
        setActive(next.active);
        setStatusFailed(false);
      } else {
        setStatusFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [verified, savedDomain]);

  async function recheck() {
    setChecking(true);
    const before = active;
    const next = await fetchStatus(true);
    apply(next);
    setChecking(false);
    // Los links del portal (tienda, productos) cambian con el dominio.
    if (next && next.active !== before) router.refresh();
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/dominio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSavedDomain(body.domain);
      setDomain(body.domain);
      setToken(body.verificationToken);
      setVerified(false);
      setActive(false);
      setStatus(null);
      setStatusFailed(false);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/dominio/verificar", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo verificar.");
        return;
      }
      setVerified(true);
      if (body.active) {
        setActive(true);
        router.refresh();
      }
    } catch {
      setError("No se pudo verificar — revisa tu conexión.");
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (active && !window.confirm(`¿Quitar ${savedDomain}? Tu tienda vuelve a ${storeSubdomain ?? "tu link de Marcolini"} y ese dominio deja de abrirla.`)) return;
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/marca/tienda/dominio", { method: "DELETE" });
      setSavedDomain(null);
      setToken(null);
      setVerified(false);
      setActive(false);
      setStatus(null);
      setStatusFailed(false);
      setDomain("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const vercel = status?.vercel ?? null;
  const apex = savedDomain ? apexOf(savedDomain) : "";

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">Dominio propio (opcional, gratis)</p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Tu tienda en tu propio dominio, en vez de {storeSubdomain ?? "{tu-tienda}.marcolini.lat"}. Los links que ya
        compartiste siguen funcionando: llevan a la misma página en tu dominio.
      </p>

      {!savedDomain ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:flex-none">
              <label className="block text-xs text-brand-ink mb-1">Tu dominio</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="tienda.tumarca.com"
                className="input text-sm w-full sm:w-72"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || !domain.trim()}
              className="bg-brand-accent text-white rounded-full px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar dominio"}
            </button>
          </div>
          <p className="text-xs text-brand-ink-soft max-w-lg">
            Si tu dominio hoy abre otra tienda (Shopify, Wix…), usa un subdominio como <span className="font-mono">tienda.tumarca.com</span>:
            tu web sigue igual. El dominio completo (<span className="font-mono">tumarca.com</span>) muévelo cuando dejes la otra tienda; sus
            links viejos de productos y colecciones llegan a la misma página en Marcolini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-brand-ink [overflow-wrap:anywhere]">{savedDomain}</span>
            {active ? (
              <Chip tone="ok">ACTIVO</Chip>
            ) : verified ? (
              <Chip tone="wait">FALTA EL DNS</Chip>
            ) : (
              <Chip tone="wait">SIN VERIFICAR</Chip>
            )}
          </div>

          {!verified && token && (
            <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-ink-soft space-y-3">
              <p>
                <span className="font-medium text-brand-ink">Paso 1 de 2: prueba que el dominio es tuyo.</span> Donde compraste el
                dominio, agrega este registro:
              </p>
              <Records records={[{ type: "TXT", name: `_marcolini-verify.${savedDomain}`, value: token }]} apex={apex} />
              <ProviderGuides />
              <p>Puede tardar unos minutos en propagar. Cuando lo hayas agregado, dale a «Verificar».</p>
              <button
                type="button"
                onClick={verify}
                disabled={verifying}
                className="bg-brand-accent text-white rounded-full px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {verifying ? "Verificando..." : "Verificar"}
              </button>
            </div>
          )}

          {verified && active && (
            <div className="rounded-xl bg-emerald-50/60 p-3 text-xs text-brand-ink-soft space-y-2">
              <p className="font-medium text-emerald-800">¡Tu tienda ya abre en {savedDomain}!</p>
              <p>
                Los links de tus productos, los de tus creadoras, los correos y los pagos ya usan tu dominio.
                {storeSubdomain ? ` Los de ${storeSubdomain} llevan a la misma página aquí, con el código de la creadora.` : ""}
              </p>
              <p>Si usas el píxel de Meta, verifica tu dominio nuevo en Meta Business (Configuración del negocio → Dominios).</p>
              <button
                type="button"
                onClick={recheck}
                disabled={checking}
                className="rounded-full border border-brand-line bg-white px-4 py-1.5 text-xs font-medium text-brand-ink hover:border-brand-ink disabled:opacity-50"
              >
                {checking ? "Revisando..." : "Revisar conexión"}
              </button>
            </div>
          )}

          {verified && !active && (
            <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-ink-soft space-y-3">
              <p>
                <span className="font-medium text-brand-ink">Paso 2 de 2: apunta el dominio a Marcolini.</span> Agrega
                {(vercel?.records.length ?? 1) > 1 ? " estos registros" : " este registro"}:
              </p>
              {!vercel ? (
                <p>{statusFailed && !checking ? "No pudimos revisar la conexión. Intenta de nuevo." : "Revisando la conexión…"}</p>
              ) : (
                <>
                  <Records records={vercel.records} apex={apex} />
                  {vercel.verification.length > 0 && (
                    <>
                      <p>Ese dominio estuvo conectado a otra cuenta, así que también pide este:</p>
                      <Records records={vercel.verification} apex={apex} />
                    </>
                  )}
                  <ProviderGuides />
                  <p>
                    El DNS puede tardar desde minutos hasta un día. Mientras tanto tu tienda sigue en{" "}
                    <span className="font-mono">{storeSubdomain ?? "tu link de Marcolini"}</span> y nada se rompe: cuando tu dominio
                    responda, cambiamos los links solos y te avisamos.
                  </p>
                  {!vercel.automatic && <p>El equipo de Marcolini termina de conectarlo de su lado; te avisamos cuando quede.</p>}
                  {vercel.error && <p className="text-amber-800">No pudimos revisar todo desde aquí; el equipo de Marcolini ya está al tanto.</p>}
                </>
              )}
              <button
                type="button"
                onClick={recheck}
                disabled={checking}
                className="bg-brand-accent text-white rounded-full px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {checking ? "Revisando..." : "Revisar conexión"}
              </button>
            </div>
          )}

          <button type="button" onClick={remove} disabled={saving} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            Quitar dominio
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
