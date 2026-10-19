"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import { PR_BOX_STAGE, dayInputValue, formatDay, prBoxContentsList, type PrBoxStage } from "@/lib/pr-box";

/// Cajas PR en Muestras (ver pr-box-service.ts): la marca arma la caja con
/// su brief, ve en qué va cada creadora (pedida → por enviar → enviada →
/// publicada, o vencida), aprueba, la envía con su guía y se la propone a
/// creadoras puntuales. Las unidades solo las ve la marca.

export type PrBoxSocial = { platform: string; handle: string; approxFollowers: number | null };

export type PrBoxRequestView = {
  id: string;
  stage: PrBoxStage;
  initiatedBy: "CREATOR" | "BRAND";
  message: string | null;
  rejectedReason: string | null;
  createdAt: string;
  postUrl: string | null;
  publishedAt: string | null;
  creator: { displayName: string; photoUrl: string | null; city: string | null; socials: PrBoxSocial[] };
  /// Solo cuando ya está aprobada (antes la marca no ve la dirección).
  shipping: { name: string; document: string | null; email: string | null; phone: string; region: string | null; city: string; address: string; notes: string | null } | null;
  order: { id: string; carrier: string | null; trackingNumber: string | null; shippedAt: string | null } | null;
};

export type PrBoxView = {
  id: string;
  name: string;
  contents: string;
  images: string[];
  units: number;
  unitsUsed: number;
  contentBrief: string;
  keyMessages: string;
  requestUntil: string | null;
  shipsOn: string | null;
  publishBy: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
  inMarketplace: boolean;
  /// Si hoy se puede pedir (abierta, con unidades y en fecha).
  accepting: boolean;
  requests: PrBoxRequestView[];
};

const STAGE_ORDER: PrBoxStage[] = ["pedida", "por-enviar", "enviada", "vencida", "publicada", "propuesta", "rechazada", "no-acepto"];

/// "3 pedidas", "1 por enviar", "2 no aceptaron".
const COUNT_LABEL: Record<PrBoxStage, [string, string]> = {
  pedida: ["pedida", "pedidas"],
  propuesta: ["propuesta", "propuestas"],
  "por-enviar": ["por enviar", "por enviar"],
  enviada: ["enviada", "enviadas"],
  publicada: ["publicada", "publicadas"],
  vencida: ["vencida", "vencidas"],
  rechazada: ["rechazada", "rechazadas"],
  "no-acepto": ["no aceptó", "no aceptaron"],
};

function StagePill({ stage }: { stage: PrBoxStage }) {
  const s = PR_BOX_STAGE[stage];
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.tone}`}>{s.brand}</span>;
}

function followers(n: number | null) {
  if (!n) return "";
  return n >= 1000 ? ` · ${(n / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil` : ` · ${n}`;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-brand-line object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent-soft text-xs font-semibold text-brand-accent">
      {name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")}
    </span>
  );
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar — revisa tu conexión.");
  return data;
}

// ------------------------------------------------------------ El formulario

type Draft = {
  name: string;
  contents: string;
  images: string[];
  units: string;
  contentBrief: string;
  keyMessages: string;
  requestUntil: string;
  shipsOn: string;
  publishBy: string;
  inMarketplace: boolean;
};

function draftFrom(box?: PrBoxView): Draft {
  return {
    name: box?.name ?? "",
    contents: box?.contents ?? "",
    images: box?.images ?? [],
    units: box ? String(box.units) : "",
    contentBrief: box?.contentBrief ?? "",
    keyMessages: box?.keyMessages ?? "",
    requestUntil: dayInputValue(box?.requestUntil),
    shipsOn: dayInputValue(box?.shipsOn),
    publishBy: dayInputValue(box?.publishBy),
    inMarketplace: box?.inMarketplace ?? true,
  };
}

function PhotosField({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 6 - images.length)) {
        const form = new FormData();
        form.append("file", await prepareImageForUpload(file));
        const res = await fetch("/api/marca/tienda/productos/imagen", { method: "POST", body: form });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.url) throw new Error(body?.error ?? "No se pudo subir la foto.");
        added.push(body.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      if (added.length) onChange([...images, ...added]);
      setUploading(false);
    }
  }
  return (
    <div>
      <p className="mb-1 text-sm text-brand-ink">Fotos de la caja</p>
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-20 w-20 rounded-xl border border-brand-line object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded-full bg-brand-ink/80 px-1.5 py-0.5 text-[10px] text-white">Portada</span>
            ) : (
              <button
                type="button"
                onClick={() => onChange([url, ...images.filter((u) => u !== url)])}
                className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] text-brand-ink hover:bg-white"
              >
                Portada
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(images.filter((u) => u !== url))}
              aria-label="Quitar foto"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-brand-line bg-white text-xs text-brand-ink-soft hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        {images.length < 6 && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-line text-center text-[11px] text-brand-ink-soft hover:bg-brand-accent-soft/40">
            {uploading ? "Subiendo…" : "+ Subir fotos"}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-brand-ink-soft">La primera es la portada. Hasta 6.</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PrBoxEditor({ box, onDone }: { box?: PrBoxView; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFrom(box));
  const [saving, setSaving] = useState<null | "DRAFT" | "OPEN" | "KEEP">(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save(status: "DRAFT" | "OPEN" | "KEEP") {
    setSaving(status);
    setError(null);
    try {
      const body = { ...draft, units: Number(draft.units || 0), status: status === "KEEP" ? box!.status : status };
      if (box) await send(`/api/marca/tienda/cajas-pr/${box.id}`, "PATCH", body);
      else await send("/api/marca/tienda/cajas-pr", "POST", body);
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-brand-accent/30 bg-brand-surface p-5">
      <p className="font-display font-semibold text-brand-ink">{box ? "Editar caja" : "Nueva Caja PR"}</p>
      <PhotosField images={draft.images} onChange={(images) => set("images", images)} />
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className="mb-1 block text-sm text-brand-ink">Nombre de la caja</label>
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Ej. Caja lanzamiento Navidad" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-brand-ink">Unidades para regalar</label>
          <input type="number" min={Math.max(1, box?.unitsUsed ?? 1)} value={draft.units} onChange={(e) => set("units", e.target.value)} placeholder="Ej. 100" className="input" />
        </div>
      </div>
      <p className="-mt-3 text-xs text-brand-ink-soft">Las creadoras no ven cuántas hay. Cada caja que apruebas usa una.</p>
      <div>
        <label className="mb-1 block text-sm text-brand-ink">Qué incluye</label>
        <textarea
          value={draft.contents}
          onChange={(e) => set("contents", e.target.value)}
          maxLength={1500}
          placeholder={"Una cosa por línea:\nGel Polish Super Black 15 ml\nTop coat\nLima de regalo"}
          className="input min-h-24"
        />
      </div>

      <div className="space-y-4 rounded-xl bg-brand-bg p-4">
        <div>
          <p className="text-sm font-medium text-brand-ink">El brief</p>
          <p className="text-xs text-brand-ink-soft">Lo ven las creadoras antes de pedirla.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-brand-ink">Qué contenido quieres</label>
          <textarea
            value={draft.contentBrief}
            onChange={(e) => set("contentBrief", e.target.value)}
            maxLength={1500}
            placeholder="Ej. Un Reel o TikTok abriendo la caja y mostrando el resultado en las uñas."
            className="input min-h-20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-brand-ink">Mensajes clave</label>
          <textarea
            value={draft.keyMessages}
            onChange={(e) => set("keyMessages", e.target.value)}
            maxLength={1500}
            placeholder="Ej. Dura 21 días. Menciona @tumarca y usa #TuMarcaNavidad."
            className="input min-h-16"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-brand-ink">Se puede pedir hasta</label>
            <input type="date" value={draft.requestUntil} onChange={(e) => set("requestUntil", e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-ink">La envías el</label>
            <input type="date" value={draft.shipsOn} onChange={(e) => set("shipsOn", e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-ink">Publicar a más tardar</label>
            <input type="date" value={draft.publishBy} onChange={(e) => set("publishBy", e.target.value)} className="input text-sm" />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-brand-ink">¿Quién la puede pedir?</legend>
        <label className="flex items-start gap-2 text-sm text-brand-ink">
          <input type="radio" checked={draft.inMarketplace} onChange={() => set("inMarketplace", true)} className="mt-1" />
          <span>
            Todas las creadoras, desde el marketplace
            <span className="block text-xs text-brand-ink-soft">Ellas la piden y tú decides a quién se la apruebas.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-brand-ink">
          <input type="radio" checked={!draft.inMarketplace} onChange={() => set("inMarketplace", false)} className="mt-1" />
          <span>
            Solo las creadoras a las que se la propongas
            <span className="block text-xs text-brand-ink-soft">No sale en el marketplace.</span>
          </span>
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {box && box.status !== "DRAFT" ? (
          <button type="button" onClick={() => save("KEEP")} disabled={saving !== null} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => save("OPEN")} disabled={saving !== null} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving === "OPEN" ? "Publicando…" : "Publicar caja"}
            </button>
            <button type="button" onClick={() => save("DRAFT")} disabled={saving !== null} className="rounded-full border border-brand-line px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50">
              {saving === "DRAFT" ? "Guardando…" : "Guardar borrador"}
            </button>
          </>
        )}
        <button type="button" onClick={onDone} disabled={saving !== null} className="text-sm text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------- Proponer a creadoras

type Proposable = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  city: string | null;
  socialLinks: PrBoxSocial[];
  linked: boolean;
  requestStatus: string | null;
};

const TAKEN_LABEL: Record<string, string> = {
  REQUESTED: "Ya la pidió",
  PROPOSED: "Ya se la propusiste",
  APPROVED: "Ya la tiene",
  REJECTED: "Se la rechazaste",
  DECLINED: "No la aceptó",
};

function ProposePanel({ box, onClose }: { box: PrBoxView; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creators, setCreators] = useState<Proposable[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const left = box.units - box.unitsUsed;

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/marca/tienda/cajas-pr/${box.id}/creadoras?q=${encodeURIComponent(query.trim())}`);
      const body = await res.json().catch(() => null);
      setCreators(res.ok ? body.creators : []);
    }, 300);
    return () => clearTimeout(timer);
  }, [box.id, query]);

  const ids = Object.keys(chosen).filter((id) => chosen[id]);

  async function propose() {
    setBusy(true);
    setNotice(null);
    try {
      const body = await send(`/api/marca/tienda/cajas-pr/${box.id}/proponer`, "POST", { creatorIds: ids, message });
      setNotice(body.proposed === 1 ? "Listo: se la propusiste a 1 creadora." : `Listo: se la propusiste a ${body.proposed} creadoras.`);
      setChosen({});
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo proponer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-line bg-brand-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-ink">Proponer a creadoras</p>
          <p className="text-xs text-brand-ink-soft">
            Primero salen las que ya trabajan contigo; escribe un nombre para buscar otras. Quedan {left} {left === 1 ? "caja" : "cajas"}: se usa una cuando una creadora acepta.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-brand-ink-soft hover:underline">
          Cerrar
        </button>
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar creadora por nombre…" className="input text-sm" />
      {creators === null ? (
        <p className="text-sm text-brand-ink-soft">Buscando…</p>
      ) : creators.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">{query.trim() ? "Ninguna creadora coincide con ese nombre." : "Todavía no tienes creadoras en tu programa. Busca por nombre."}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-brand-line overflow-y-auto rounded-lg border border-brand-line bg-brand-surface">
          {creators.map((c) => {
            const taken = c.requestStatus ? TAKEN_LABEL[c.requestStatus] : null;
            const main = c.socialLinks[0];
            return (
              <li key={c.id}>
                <label className={`flex items-center gap-3 px-3 py-2 ${taken ? "opacity-60" : "cursor-pointer hover:bg-brand-accent-soft/30"}`}>
                  <input type="checkbox" disabled={Boolean(taken)} checked={Boolean(chosen[c.id])} onChange={(e) => setChosen((prev) => ({ ...prev, [c.id]: e.target.checked }))} />
                  <Avatar name={c.displayName} photoUrl={c.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-brand-ink">
                      {c.displayName}
                      {c.linked && <span className="ml-2 rounded-full bg-brand-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">Trabaja contigo</span>}
                    </span>
                    <span className="block truncate text-xs text-brand-ink-soft">
                      {[main ? `@${main.handle.replace(/^@/, "")}${followers(main.approxFollowers)}` : null, c.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {taken && <span className="shrink-0 text-xs text-brand-ink-soft">{taken}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        placeholder="Mensaje para ellas (opcional). Ej. Nos encanta tu nail art: queremos que seas de las primeras en probar la colección."
        className="input min-h-16 text-sm"
      />
      {notice && <p className="text-sm text-brand-ink">{notice}</p>}
      <button
        type="button"
        onClick={propose}
        disabled={busy || ids.length === 0}
        className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Proponiendo…" : ids.length > 1 ? `Proponer a ${ids.length} creadoras` : "Proponer"}
      </button>
    </div>
  );
}

// -------------------------------------------------- Cada creadora con su caja

function RequestRow({ request, box }: { request: PrBoxRequestView; box: PrBoxView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState(request.order?.carrier ?? "");
  const [tracking, setTracking] = useState(request.order?.trackingNumber ?? "");

  async function act(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/marca/tienda/cajas-pr/solicitudes/${request.id}`, "PATCH", body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start gap-3">
        <Avatar name={request.creator.displayName} photoUrl={request.creator.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-brand-ink">{request.creator.displayName}</p>
            <StagePill stage={request.stage} />
          </div>
          <p className="text-xs text-brand-ink-soft">
            {[
              ...request.creator.socials.slice(0, 2).map((s) => `${s.platform} @${s.handle.replace(/^@/, "")}${followers(s.approxFollowers)}`),
              request.shipping?.city ?? request.creator.city,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin redes en su perfil"}
          </p>
          {request.message && (
            <p className="mt-1 text-xs italic text-brand-ink-soft">
              {request.initiatedBy === "BRAND" ? "Tu mensaje: " : ""}&ldquo;{request.message}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="pl-12 space-y-2">
        {request.stage === "pedida" &&
          (rejecting ? (
            <div className="space-y-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motivo (opcional, se lo contamos)" className="input text-xs" />
              <div className="flex gap-2">
                <button type="button" onClick={() => act({ action: "reject", reason })} disabled={busy} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  Confirmar rechazo
                </button>
                <button type="button" onClick={() => setRejecting(false)} disabled={busy} className="text-xs text-brand-ink-soft hover:underline">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => act({ action: "approve" })}
                disabled={busy || box.unitsUsed >= box.units}
                className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Aprobando…" : "Aprobar"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="rounded-full border border-brand-line px-4 py-1.5 text-xs font-medium hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                Rechazar
              </button>
              {box.unitsUsed >= box.units && <span className="self-center text-xs text-amber-700">No quedan cajas: súbele unidades.</span>}
            </div>
          ))}

        {request.stage === "propuesta" && <p className="text-xs text-brand-ink-soft">Se la propusiste: esperando que acepte y deje su dirección.</p>}

        {request.shipping && (request.stage === "por-enviar" || request.stage === "enviada" || request.stage === "vencida") && (
          <div className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-ink-soft">
            <p className="font-medium text-brand-ink">
              Enviar a {request.shipping.name}
              {request.shipping.document ? ` · CC ${request.shipping.document}` : ""}
            </p>
            <p>
              {request.shipping.address}, {request.shipping.city}
              {request.shipping.region ? `, ${request.shipping.region}` : ""}
            </p>
            <p>
              {request.shipping.phone}
              {request.shipping.email ? ` · ${request.shipping.email}` : ""}
            </p>
            {request.shipping.notes && <p>{request.shipping.notes}</p>}
          </div>
        )}

        {request.stage === "por-enviar" && (
          <div className="flex flex-wrap items-end gap-2">
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={80} placeholder="Transportadora" className="input w-36 text-xs" />
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} placeholder="Número de guía" className="input w-40 text-xs" />
            <button type="button" onClick={() => act({ action: "ship", carrier, trackingNumber: tracking })} disabled={busy} className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {busy ? "Guardando…" : "Marcar como enviada"}
            </button>
          </div>
        )}

        {(request.stage === "enviada" || request.stage === "vencida") && (
          <p className="text-xs text-brand-ink-soft">
            Enviada{request.order?.shippedAt ? ` el ${formatDay(request.order.shippedAt)}` : ""}
            {request.order?.trackingNumber ? ` · ${[request.order.carrier, request.order.trackingNumber].filter(Boolean).join(" ")}` : ""}.{" "}
            {request.stage === "vencida"
              ? `Se pasó la fecha para publicar (${formatDay(box.publishBy!)}) y no ha subido su link.`
              : box.publishBy
                ? `Tiene hasta el ${formatDay(box.publishBy)} para publicar.`
                : "Esperando su publicación."}
          </p>
        )}

        {request.stage === "publicada" && request.postUrl && (
          <p className="text-xs text-brand-ink-soft">
            <a href={request.postUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-accent hover:underline">
              Ver publicación ↗
            </a>
            {request.publishedAt ? ` · la subió el ${formatDay(request.publishedAt)}` : ""}
          </p>
        )}

        {request.stage === "rechazada" && <p className="text-xs text-brand-ink-soft">La rechazaste{request.rejectedReason ? `: ${request.rejectedReason}` : "."}</p>}

        {request.order && (request.stage === "por-enviar" || request.stage === "enviada") && (
          <Link href={`/marca/tienda/pedidos/${request.order.id}`} className="inline-block text-xs text-brand-ink-soft hover:underline">
            Ver el pedido →
          </Link>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </li>
  );
}

// ------------------------------------------------------------- Cada caja

function statusPill(box: PrBoxView) {
  if (box.status === "DRAFT") return { label: "Borrador", tone: "bg-neutral-100 text-neutral-700 border-neutral-200" };
  if (box.status === "CLOSED") return { label: "Cerrada", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" };
  if (box.unitsUsed >= box.units) return { label: "Agotada", tone: "bg-amber-50 text-amber-800 border-amber-200" };
  if (!box.accepting) return { label: "Ya no se puede pedir", tone: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Abierta", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

function PrBoxCard({ box }: { box: PrBoxView }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "edit" | "propose">(null);
  const [open, setOpen] = useState(box.requests.some((r) => r.stage === "pedida" || r.stage === "por-enviar"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pill = statusPill(box);
  const counts = STAGE_ORDER.map((stage) => ({ stage, n: box.requests.filter((r) => r.stage === stage).length })).filter((c) => c.n > 0);
  const contents = prBoxContentsList(box.contents);

  async function change(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/marca/tienda/cajas-pr/${box.id}`, method, body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "edit") return <PrBoxEditor box={box} onDone={() => setMode(null)} />;

  return (
    <div className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
      <div className="flex items-start gap-4">
        {box.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={box.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-brand-line object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft text-[10px] font-mono tracking-widest text-brand-accent">PR</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-semibold text-brand-ink">{box.name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill.tone}`}>{pill.label}</span>
            <span className="text-[11px] text-brand-ink-soft">{box.inMarketplace ? "En el marketplace" : "Solo invitadas"}</span>
          </div>
          <p className="mt-0.5 text-xs text-brand-ink-soft tabular-nums">
            {[
              `Quedan ${box.units - box.unitsUsed} de ${box.units}`,
              box.requestUntil ? `se pide hasta el ${formatDay(box.requestUntil)}` : null,
              box.shipsOn ? `envío el ${formatDay(box.shipsOn)}` : null,
              box.publishBy ? `publicar antes del ${formatDay(box.publishBy)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {contents.length > 0 && <p className="mt-0.5 truncate text-xs text-brand-ink-soft">Trae: {contents.join(" · ")}</p>}
        </div>
      </div>

      {counts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {counts.map((c) => (
            <span key={c.stage} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${PR_BOX_STAGE[c.stage].tone}`}>
              {c.n} {COUNT_LABEL[c.stage][c.n === 1 ? 0 : 1]}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {box.requests.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-brand-accent hover:underline">
            {open ? "Ocultar creadoras" : `Ver creadoras (${box.requests.length})`}
          </button>
        )}
        {box.status === "OPEN" && (
          <button type="button" onClick={() => setMode(mode === "propose" ? null : "propose")} className="font-medium text-brand-accent hover:underline">
            Proponer a creadoras
          </button>
        )}
        <button type="button" onClick={() => setMode("edit")} className="text-brand-ink hover:underline">
          Editar
        </button>
        {box.status === "DRAFT" && (
          <button type="button" onClick={() => change("PATCH", { status: "OPEN" })} disabled={busy} className="text-brand-ink hover:underline disabled:opacity-50">
            Publicar
          </button>
        )}
        {box.status === "OPEN" && (
          <button type="button" onClick={() => change("PATCH", { status: "CLOSED" })} disabled={busy} className="text-brand-ink-soft hover:underline disabled:opacity-50">
            Cerrar
          </button>
        )}
        {box.status === "CLOSED" && (
          <button type="button" onClick={() => change("PATCH", { status: "OPEN" })} disabled={busy} className="text-brand-ink hover:underline disabled:opacity-50">
            Volver a abrir
          </button>
        )}
        {box.unitsUsed === 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Borrar la caja "${box.name}"?`)) change("DELETE");
            }}
            disabled={busy}
            className="text-brand-ink-soft hover:text-red-700 hover:underline disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "propose" && <ProposePanel box={box} onClose={() => setMode(null)} />}

      {open && box.requests.length > 0 && (
        <ul className="divide-y divide-brand-line border-t border-brand-line">
          {[...box.requests]
            .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
            .map((r) => (
              <RequestRow key={r.id} request={r} box={box} />
            ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Panel

const HOW_IT_WORKS = [
  { title: "Arma la caja", text: "Fotos, qué trae, cuántas tienes y el brief: qué contenido quieres y las fechas." },
  { title: "Apruebas y la envías", text: "Las creadoras la piden (o se la propones tú). Al aprobar ves su dirección y la envías con su guía." },
  { title: "Ellas publican", text: "Cada creadora sube el link de su publicación y ves en qué va cada una." },
];

export function PrBoxesPanel({ boxes }: { boxes: PrBoxView[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="font-display text-base font-semibold text-brand-ink">Cajas PR</h2>
          <p className="text-sm text-brand-ink-soft">Para un lanzamiento o una campaña: una caja armada solo para creadoras, con su brief. No sale en tu tienda.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90">
            + Crear Caja PR
          </button>
        )}
      </div>

      {creating && <PrBoxEditor onDone={() => setCreating(false)} />}

      {boxes.length === 0 && !creating && (
        <ol className="grid gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-brand-line bg-brand-surface p-4">
              <p className="font-mono text-[11px] tracking-widest text-brand-accent">PASO {i + 1}</p>
              <p className="mt-1 text-sm font-medium text-brand-ink">{step.title}</p>
              <p className="mt-1 text-xs text-brand-ink-soft">{step.text}</p>
            </li>
          ))}
        </ol>
      )}

      {boxes.map((box) => (
        <PrBoxCard key={box.id} box={box} />
      ))}
    </section>
  );
}
