"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No se pudo completar. Intenta de nuevo.");
  return data;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : "No se pudo completar.";
}

/// Admin → Aliados: crear uno nuevo.
export function NewAllyForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = await call("/api/admin/aliados", "POST", form);
      router.push(`/admin/aliados/${body.allyId}`);
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
      <p className="text-sm font-medium text-brand-ink">Nuevo aliado</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="input text-sm" aria-label="Nombre del aliado" />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo (con este entra a su portal)" className="input text-sm" aria-label="Correo del aliado" />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Celular (opcional)" className="input text-sm" aria-label="Celular del aliado" />
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Su link: marcolini.lat/unete/… (opcional)" className="input text-sm" aria-label="Link del aliado" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-full bg-brand-accent text-white px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
        {saving ? "Creando…" : "Crear aliado"}
      </button>
    </form>
  );
}

/// Link de acceso al portal del aliado y pausar/reactivar su link.
export function AllyAccessPanel({ allyId, status }: { allyId: string; status: "ACTIVE" | "PAUSED" }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(send: boolean) {
    setBusy(true);
    setNote(null);
    try {
      const body = await call(`/api/admin/aliados/${allyId}/acceso`, "POST", { send });
      setLink(body.url);
      setNote(send ? (body.emailed ? `Se lo mandamos a ${body.emailed}.` : `No salió el correo: ${body.emailError ?? "intenta de nuevo"}. Mándale este link por WhatsApp.`) : "Link listo: sirve una vez y dura 7 días.");
    } catch (err) {
      setNote(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    try {
      await call(`/api/admin/aliados/${allyId}`, "PATCH", { status: status === "ACTIVE" ? "PAUSED" : "ACTIVE" });
      router.refresh();
    } catch (err) {
      setNote(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => generate(true)} className="rounded-full bg-brand-ink text-white px-4 py-2 text-xs font-medium disabled:opacity-50">
          Mandarle el link de acceso por correo
        </button>
        <button type="button" disabled={busy} onClick={() => generate(false)} className="rounded-full border border-brand-line px-4 py-2 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50">
          Copiar link de acceso
        </button>
        <button type="button" disabled={busy} onClick={toggle} className="rounded-full border border-brand-line px-4 py-2 text-xs font-medium text-brand-ink-soft hover:text-brand-ink disabled:opacity-50">
          {status === "ACTIVE" ? "Pausar su link" : "Reactivar su link"}
        </button>
      </div>
      {link && <input readOnly value={link} className="input text-xs font-mono" aria-label="Link de acceso" onFocus={(e) => e.target.select()} />}
      {note && <p className="text-xs text-brand-ink-soft">{note}</p>}
    </div>
  );
}

type Option = { id: string; name: string };

/// Una solicitud del link: aprobarla, rechazarla o vincularla a la marca o
/// creadora ya creada.
export function AllyLeadActions({
  allyId,
  leadId,
  kind,
  status,
  brands,
  creators,
}: {
  allyId: string;
  leadId: string;
  kind: "BRAND" | "CREATOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  brands: Option[];
  creators: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = kind === "BRAND" ? brands : creators;
  const [picked, setPicked] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={picked} onChange={(e) => setPicked(e.target.value)} className="input text-xs max-w-56" aria-label={kind === "BRAND" ? "Marca a vincular" : "Creadora a vincular"}>
          <option value="">{kind === "BRAND" ? "Vincular a la marca…" : "Vincular a la creadora…"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !picked}
          onClick={() => run(() => call(`/api/admin/aliados/${allyId}/vinculos`, "POST", kind === "BRAND" ? { leadId, brandId: picked } : { leadId, creatorId: picked }))}
          className="rounded-full bg-brand-ink text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          Vincular
        </button>
        {status !== "REJECTED" && (
          <button type="button" disabled={busy} onClick={() => run(() => call(`/api/admin/aliados/${allyId}/solicitudes`, "PATCH", { leadId, status: "REJECTED" }))} className="text-xs text-red-600 hover:underline">
            No entró
          </button>
        )}
        {status === "PENDING" && (
          <button type="button" disabled={busy} onClick={() => run(() => call(`/api/admin/aliados/${allyId}/solicitudes`, "PATCH", { leadId, status: "APPROVED" }))} className="text-xs text-brand-ink-soft hover:underline">
            Aprobada (todavía sin cuenta)
          </button>
        )}
        {status !== "PENDING" && (
          <button type="button" disabled={busy} onClick={() => run(() => call(`/api/admin/aliados/${allyId}/solicitudes`, "PATCH", { leadId, status: "PENDING" }))} className="text-xs text-brand-ink-soft hover:underline">
            Volver a revisión
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/// Vincular a mano una marca o creadora que llegó sin pasar por el link.
export function AllyManualLink({ allyId, brands, creators }: { allyId: string; brands: Option[]; creators: Option[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"BRAND" | "CREATOR">("BRAND");
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = kind === "BRAND" ? brands : creators;

  async function link() {
    setBusy(true);
    setError(null);
    try {
      await call(`/api/admin/aliados/${allyId}/vinculos`, "POST", kind === "BRAND" ? { brandId: picked } : { creatorId: picked });
      setPicked("");
      router.refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => { setKind(e.target.value as "BRAND" | "CREATOR"); setPicked(""); }} className="input text-xs max-w-32" aria-label="Tipo a vincular">
          <option value="BRAND">Marca</option>
          <option value="CREATOR">Creadora</option>
        </select>
        <select value={picked} onChange={(e) => setPicked(e.target.value)} className="input text-xs max-w-64" aria-label="A quién vincular">
          <option value="">Elige…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={busy || !picked} onClick={link} className="rounded-full bg-brand-ink text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          Vincular
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AllyUnlinkButton({ allyId, referralId, name }: { allyId: string; referralId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function unlink() {
    if (!window.confirm(`¿Quitar el vínculo con ${name}? El aliado deja de ganar por sus ventas.`)) return;
    setBusy(true);
    try {
      await call(`/api/admin/aliados/${allyId}/vinculos?referralId=${encodeURIComponent(referralId)}`, "DELETE");
      router.refresh();
    } catch (err) {
      window.alert(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" disabled={busy} onClick={unlink} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      Quitar
    </button>
  );
}

/// Marcar pagado un mes (con el valor y la referencia de la transferencia) o deshacerlo.
export function AllyPayoutAction({ allyId, monthKey, commission, paid }: { allyId: string; monthKey: string; commission: number; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(commission)));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => window.confirm("¿Deshacer este pago?") && run(() => call(`/api/admin/aliados/${allyId}/pagos?period=${monthKey}`, "DELETE"))}
        className="text-xs text-brand-ink-soft hover:underline"
      >
        Deshacer
      </button>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft">
        Marcar pagado
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="input text-xs w-32 text-right" aria-label="Valor pagado" />
      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia (opcional)" className="input text-xs w-44" aria-label="Referencia del pago" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !Number(amount)}
          onClick={() => run(() => call(`/api/admin/aliados/${allyId}/pagos`, "POST", { period: monthKey, amount: Number(amount), reference }))}
          className="rounded-full bg-brand-ink text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          Guardar pago
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
