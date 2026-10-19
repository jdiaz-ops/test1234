"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SampleShippingFields, isShippingComplete, type SampleShipping } from "@/components/portal/sample-shipping-fields";
import { PR_BOX_STAGE, formatDay, prBoxContentsList, type PrBoxStage } from "@/lib/pr-box";

/// Cajas PR en el marketplace de la creadora (ver pr-box-service.ts): las
/// cajas abiertas con su brief para pedirlas, y "Tus cajas" con en qué va
/// cada una — aceptar la que le propusieron, la guía cuando sale y el link
/// de su publicación. Nunca ve cuántas unidades hay.

export type CreatorPrBox = {
  id: string;
  name: string;
  contents: string;
  images: string[];
  contentBrief: string;
  keyMessages: string;
  requestUntil: string | null;
  shipsOn: string | null;
  publishBy: string | null;
  brand: { name: string; logoSrc: string | null };
  /// Su código con esa marca, si ya está en su programa.
  code: string | null;
};

export type CreatorPrBoxRequest = {
  id: string;
  stage: PrBoxStage;
  message: string | null;
  rejectedReason: string | null;
  postUrl: string | null;
  order: { carrier: string | null; trackingNumber: string | null; shippedAt: string | null } | null;
  box: CreatorPrBox;
};

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar — revisa tu conexión.");
  return data;
}

function BrandLine({ brand }: { brand: CreatorPrBox["brand"] }) {
  return (
    <div className="flex items-center gap-2">
      {brand.logoSrc ? (
        <span className="flex h-7 min-w-7 max-w-[5.5rem] items-center justify-center rounded-lg border border-brand-line bg-white px-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoSrc} alt="" className="h-4 w-auto max-w-[4.5rem] object-contain" />
        </span>
      ) : null}
      <span className="truncate text-xs font-medium text-brand-ink-soft">{brand.name}</span>
    </div>
  );
}

/// Las fechas del brief, en chips.
function Dates({ box }: { box: CreatorPrBox }) {
  const items = [
    box.requestUntil ? `Pídela hasta el ${formatDay(box.requestUntil)}` : null,
    box.shipsOn ? `Sale el ${formatDay(box.shipsOn)}` : null,
    box.publishBy ? `Publica antes del ${formatDay(box.publishBy)}` : null,
  ].filter((v): v is string => Boolean(v));
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-brand-bg px-2.5 py-1 text-[11px] text-brand-ink">
          {item}
        </span>
      ))}
    </div>
  );
}

/// Todo lo que la marca quiere que sepa antes de pedirla.
function Brief({ box }: { box: CreatorPrBox }) {
  const contents = prBoxContentsList(box.contents);
  return (
    <div className="space-y-4">
      {box.images.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {box.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-24 w-24 shrink-0 rounded-xl border border-brand-line object-cover" />
          ))}
        </div>
      )}
      {contents.length > 0 && (
        <div>
          <p className="font-mono text-[11px] tracking-widest text-brand-accent">QUÉ TRAE</p>
          <ul className="mt-1 space-y-0.5 text-sm text-brand-ink">
            {contents.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-brand-accent">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="font-mono text-[11px] tracking-widest text-brand-accent">LO QUE QUIERE LA MARCA</p>
        <p className="mt-1 whitespace-pre-line text-sm text-brand-ink">{box.contentBrief}</p>
      </div>
      {box.keyMessages && (
        <div>
          <p className="font-mono text-[11px] tracking-widest text-brand-accent">MENSAJES CLAVE</p>
          <p className="mt-1 whitespace-pre-line text-sm text-brand-ink">{box.keyMessages}</p>
        </div>
      )}
      <Dates box={box} />
      {box.code && (
        <p className="rounded-lg bg-brand-accent-soft px-3 py-2 text-sm text-brand-ink">
          Tu código con {box.brand.name}: <span className="font-mono font-semibold">{box.code}</span>. Ponlo en tu publicación para que tu comunidad compre con descuento y tú ganes tu comisión.
        </p>
      )}
    </div>
  );
}

function RequestForm({ box, defaultShipping, onCancel }: { box: CreatorPrBox; defaultShipping: SampleShipping; onCancel: () => void }) {
  const router = useRouter();
  const [shipping, setShipping] = useState(defaultShipping);
  const [message, setMessage] = useState("");
  const [promise, setPromise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/creador/cajas-pr/${box.id}`, "POST", { ...shipping, message });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pedir.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-brand-line pt-4">
      <div>
        <label className="mb-1 block text-sm text-brand-ink">Cuéntale a {box.brand.name} por qué tú (opcional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="Ej. Hago tutoriales de nail art y mi comunidad me pide productos para principiantes."
          className="input min-h-16 text-sm"
        />
      </div>
      <SampleShippingFields value={shipping} onChange={setShipping} />
      <label className="flex items-start gap-2 text-sm text-brand-ink">
        <input type="checkbox" checked={promise} onChange={(e) => setPromise(e.target.checked)} className="mt-1" />
        <span>
          Si me la aprueban, publico {box.publishBy ? `antes del ${formatDay(box.publishBy)}` : "cuando me llegue"} y subo el link aquí.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !promise || !isShippingComplete(shipping)}
          className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Pidiendo…" : "Pedir la caja"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function OpenBoxCard({ box, defaultShipping }: { box: CreatorPrBox; defaultShipping: SampleShipping }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const contents = prBoxContentsList(box.contents);
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface ${open ? "sm:col-span-2" : ""}`}>
      {box.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={box.images[0]} alt="" className={`w-full object-cover ${open ? "aspect-[16/7]" : "aspect-[4/3]"}`} />
      ) : (
        <div className={`flex w-full items-center justify-center bg-brand-accent-soft font-mono text-xs tracking-widest text-brand-accent ${open ? "aspect-[16/7]" : "aspect-[4/3]"}`}>
          CAJA PR
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <BrandLine brand={box.brand} />
        <div>
          <h3 className="font-display text-lg font-semibold leading-snug text-brand-ink text-balance">{box.name}</h3>
          {!open && contents.length > 0 && <p className="mt-1 line-clamp-2 text-sm text-brand-ink-soft">Trae: {contents.join(" · ")}</p>}
        </div>
        {open ? <Brief box={box} /> : <Dates box={box} />}
        <div className="mt-auto">
          {open ? (
            asking ? (
              <RequestForm box={box} defaultShipping={defaultShipping} onCancel={() => setAsking(false)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3 border-t border-brand-line pt-4">
                <button type="button" onClick={() => setAsking(true)} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90">
                  Quiero esta caja
                </button>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-brand-ink-soft hover:underline">
                  Cerrar
                </button>
              </div>
            )
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full border border-brand-line px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft">
              Ver el brief y pedirla
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PostLinkForm({ request }: { request: CreatorPrBoxRequest }) {
  const router = useRouter();
  const [url, setUrl] = useState(request.postUrl ?? "");
  const [editing, setEditing] = useState(!request.postUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/creador/cajas-pr/solicitudes/${request.id}`, "PATCH", { action: "post", postUrl: url.trim() });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing && request.postUrl) {
    return (
      <p className="text-sm text-brand-ink-soft">
        <a href={request.postUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-accent hover:underline">
          Ver tu publicación ↗
        </a>{" "}
        ·{" "}
        <button type="button" onClick={() => setEditing(true)} className="hover:underline">
          Cambiar link
        </button>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm text-brand-ink">¿Ya publicaste? Pega el link de tu publicación</label>
      <div className="flex flex-wrap gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" className="input min-w-0 flex-1 text-sm" />
        <button type="button" onClick={save} disabled={busy || !url.trim()} className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar link"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ProposalActions({ request, defaultShipping }: { request: CreatorPrBoxRequest; defaultShipping: SampleShipping }) {
  const router = useRouter();
  const [shipping, setShipping] = useState(defaultShipping);
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    try {
      await send(`/api/creador/cajas-pr/solicitudes/${request.id}`, "PATCH", action === "accept" ? { action, ...shipping } : { action });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <SampleShippingFields value={shipping} onChange={setShipping} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => act("accept")}
          disabled={busy !== null || !isShippingComplete(shipping)}
          className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy === "accept" ? "Aceptando…" : "Aceptar la caja"}
        </button>
        <button type="button" onClick={() => act("decline")} disabled={busy !== null} className="text-sm text-brand-ink-soft hover:underline disabled:opacity-50">
          {busy === "decline" ? "Un momento…" : "No, gracias"}
        </button>
      </div>
    </div>
  );
}

function MyBoxCard({ request, defaultShipping }: { request: CreatorPrBoxRequest; defaultShipping: SampleShipping }) {
  const [briefOpen, setBriefOpen] = useState(request.stage === "propuesta");
  const { box } = request;
  const stage = PR_BOX_STAGE[request.stage];
  const order = request.order;
  return (
    <li className="space-y-3 rounded-2xl border border-brand-line bg-brand-surface p-4">
      <div className="flex items-start gap-3">
        {box.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={box.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-brand-line object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft text-[10px] font-mono tracking-widest text-brand-accent">PR</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-brand-ink">{box.name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${stage.tone}`}>{stage.creator}</span>
          </div>
          <p className="text-xs text-brand-ink-soft">{box.brand.name}</p>
        </div>
      </div>

      <div className="text-sm text-brand-ink-soft">
        {request.stage === "propuesta" && (
          <p>
            {box.brand.name} te propone su caja. Mira el brief y, si te gusta, acéptala con tu dirección.
            {request.message ? <span className="mt-1 block italic">&ldquo;{request.message}&rdquo;</span> : null}
          </p>
        )}
        {request.stage === "pedida" && <p>Le avisamos a {box.brand.name}. Te contamos cuando la apruebe.</p>}
        {request.stage === "por-enviar" && (
          <p>¡Aprobada! {box.shipsOn ? `${box.brand.name} te la envía el ${formatDay(box.shipsOn)}.` : `${box.brand.name} te la envía pronto.`} Te llega la guía a tu correo.</p>
        )}
        {(request.stage === "enviada" || request.stage === "vencida") && (
          <p>
            Va en camino{order?.trackingNumber ? ` · guía ${[order.carrier, order.trackingNumber].filter(Boolean).join(" ")}` : ""}.{" "}
            {request.stage === "vencida"
              ? `Se pasó la fecha para publicar (${formatDay(box.publishBy!)}). Si ya publicaste, pega tu link.`
              : box.publishBy
                ? `Tienes hasta el ${formatDay(box.publishBy)} para publicar.`
                : "Cuando publiques, pega tu link aquí."}
          </p>
        )}
        {request.stage === "publicada" && <p>¡Gracias! {box.brand.name} ya ve tu publicación.</p>}
        {request.stage === "rechazada" && <p>{box.brand.name} no puede enviártela esta vez.{request.rejectedReason ? ` Motivo: ${request.rejectedReason}` : ""}</p>}
        {request.stage === "no-acepto" && <p>No la aceptaste.</p>}
      </div>

      {(request.stage === "enviada" || request.stage === "vencida" || request.stage === "publicada" || request.stage === "por-enviar") && <PostLinkForm request={request} />}

      {request.stage !== "rechazada" && request.stage !== "no-acepto" && (
        <div>
          <button type="button" onClick={() => setBriefOpen((o) => !o)} className="text-sm font-medium text-brand-accent hover:underline">
            {briefOpen ? "Ocultar el brief" : "Ver el brief"}
          </button>
          {briefOpen && (
            <div className="mt-3 rounded-xl bg-brand-bg/60 p-4">
              <Brief box={box} />
            </div>
          )}
        </div>
      )}

      {request.stage === "propuesta" && <ProposalActions request={request} defaultShipping={defaultShipping} />}
    </li>
  );
}

export function CreatorPrBoxesPanel({
  boxes,
  requests,
  defaultShipping,
}: {
  boxes: CreatorPrBox[];
  requests: CreatorPrBoxRequest[];
  defaultShipping: SampleShipping;
}) {
  return (
    <div className="space-y-10">
      <div className="max-w-xl">
        <p className="text-sm text-brand-ink-soft">
          Cajas que arman las marcas para un lanzamiento o una campaña. Pídela, y si te la aprueban te llega a tu casa: publicas con lo que te pidieron y subes el link aquí.
        </p>
      </div>

      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-brand-ink">Tus cajas</h2>
          <ul className="space-y-3">
            {requests.map((r) => (
              <MyBoxCard key={r.id} request={r} defaultShipping={defaultShipping} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-brand-ink">Cajas abiertas</h2>
        {boxes.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">Por ahora no hay cajas abiertas. Cuando una marca arme una, aparece aquí.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {boxes.map((box) => (
              <OpenBoxCard key={box.id} box={box} defaultShipping={defaultShipping} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
