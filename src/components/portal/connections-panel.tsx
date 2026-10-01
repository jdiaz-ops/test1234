"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEBHOOK_TOPICS, webhookTopicLabel } from "@/lib/webhook-topics";

type Delivery = {
  id: string;
  topic: string;
  test: boolean;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  payload: string;
};

type Webhook = { id: string; topic: string; url: string; deliveries: Delivery[] };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-brand-line bg-brand-surface ${className}`}>{children}</section>;
}

function StatusChip({ delivery }: { delivery: Delivery }) {
  if (delivery.status === "SUCCEEDED")
    return <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-emerald-100 text-emerald-800">Entregado</span>;
  if (delivery.status === "FAILED")
    return <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-red-100 text-red-700">No llegó</span>;
  return <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-amber-100 text-amber-800">Enviando</span>;
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/marca/tienda/conexiones/envios/${delivery.id}/reenviar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "No se pudo reenviar.");
      return;
    }
    router.refresh();
  }

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-brand-ink-soft tabular-nums w-28 shrink-0">{dateFormat.format(new Date(delivery.createdAt))}</span>
        <StatusChip delivery={delivery} />
        {delivery.test && <span className="text-[11px] text-brand-ink-soft border border-brand-line rounded-md px-1.5 py-0.5">Prueba</span>}
        {delivery.status === "FAILED" && delivery.lastError && (
          <span className="text-red-700">{delivery.lastError}</span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-brand-ink-soft hover:text-brand-ink">
            {open ? "Ocultar datos" : "Ver datos"}
          </button>
          {delivery.status !== "SUCCEEDED" && (
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="font-medium text-brand-accent hover:underline disabled:opacity-50"
            >
              {busy ? "Reenviando..." : "Reenviar"}
            </button>
          )}
        </span>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {open && (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-brand-bg border border-brand-line p-3 text-[11px] leading-relaxed text-brand-ink">
          {delivery.payload}
        </pre>
      )}
    </li>
  );
}

function WebhookRow({ webhook }: { webhook: Webhook }) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    const res = await fetch(`/api/marca/tienda/conexiones/webhooks/${webhook.id}/prueba`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setTesting(false);
    if (!res.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo enviar la prueba." });
      return;
    }
    const d = body.delivery as Delivery;
    setMessage(
      d.status === "SUCCEEDED"
        ? { ok: true, text: `La prueba llegó (respondió ${d.lastStatusCode}).` }
        : { ok: false, text: `La prueba no llegó: ${d.lastError ?? "sin respuesta"}` },
    );
    setHistoryOpen(true);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el webhook "${webhookTopicLabel(webhook.topic)}"? Esa URL deja de recibir avisos.`)) return;
    setDeleting(true);
    await fetch(`/api/marca/tienda/conexiones/webhooks/${webhook.id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  const failedRecently = webhook.deliveries.some((d) => d.status === "FAILED" && !d.test);

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brand-ink flex items-center gap-2">
            {webhookTopicLabel(webhook.topic)}
            {failedRecently && <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-red-100 text-red-700">Con fallas</span>}
          </p>
          <p className="text-xs text-brand-ink-soft break-all mt-0.5">
            {webhook.url} <span className="whitespace-nowrap">• JSON</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <button type="button" onClick={sendTest} disabled={testing} className="font-medium text-brand-accent hover:underline disabled:opacity-50">
            {testing ? "Enviando..." : "Enviar prueba"}
          </button>
          <button type="button" onClick={remove} disabled={deleting} className="text-red-600 hover:underline disabled:opacity-50">
            Eliminar
          </button>
        </div>
      </div>
      {message && <p className={`text-xs mt-2 ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      <button
        type="button"
        onClick={() => setHistoryOpen((o) => !o)}
        className="text-xs text-brand-ink-soft hover:text-brand-ink mt-2"
      >
        {historyOpen ? "Ocultar envíos" : `Últimos envíos (${webhook.deliveries.length})`}
      </button>
      {historyOpen &&
        (webhook.deliveries.length === 0 ? (
          <p className="text-xs text-brand-ink-soft mt-2">Todavía no se ha enviado nada. Prueba con &ldquo;Enviar prueba&rdquo;.</p>
        ) : (
          <ul className="mt-1 divide-y divide-brand-line">
            {webhook.deliveries.map((d) => (
              <DeliveryRow key={d.id} delivery={d} />
            ))}
          </ul>
        ))}
    </li>
  );
}

function CreateWebhookForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [topic, setTopic] = useState<string>("orders/updated");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/marca/tienda/conexiones/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, url }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "No se pudo guardar.");
      return;
    }
    router.refresh();
    onDone();
  }

  const hint = WEBHOOK_TOPICS.find((t) => t.topic === topic)?.hint;

  return (
    <form onSubmit={submit} className="px-5 py-4 space-y-3 bg-brand-bg/60">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Evento</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="input text-sm">
            {WEBHOOK_TOPICS.map((t) => (
              <option key={t.topic} value={t.topic}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">URL</label>
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            spellCheck={false}
            className="input text-sm font-mono"
          />
        </div>
      </div>
      {hint && <p className="text-xs text-brand-ink-soft">{hint} Formato: JSON, igual que Shopify.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar webhook"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SigningSecret({ secret }: { secret: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia la clave:", secret);
    }
  }

  return (
    <div className="px-5 py-3 border-t border-brand-line bg-brand-bg/60 rounded-b-2xl flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-ink-soft">
      <span>Tus webhooks se firman con</span>
      <span className="font-mono text-brand-ink break-all">{visible ? secret : `••••••••${secret.slice(-6)}`}</span>
      <button type="button" onClick={() => setVisible((v) => !v)} className="hover:text-brand-ink">
        {visible ? "Ocultar" : "Mostrar"}
      </button>
      <button type="button" onClick={copy} className="font-medium text-brand-accent hover:underline">
        {copied ? "Copiada ✓" : "Copiar"}
      </button>
    </div>
  );
}

/// Configuración → Conexiones. Webhooks como los de Shopify (Configuración
/// → Notificaciones → Webhooks allá): un evento + una URL, en JSON con el
/// mismo formato, firmados con la clave de la tienda. Más la guía para
/// conectar Dataico, que es para lo que la marca lo pidió. Ver
/// webhook-service.ts y conversación del 2026-10-01.
export function ConnectionsPanel({ webhooks, signingSecret }: { webhooks: Webhook[]; signingSecret: string }) {
  const [creating, setCreating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(webhooks.length === 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-brand-ink-soft max-w-2xl">
        Envía tus pedidos y clientes a otros sistemas apenas pasan: facturación
        electrónica, Google Sheets, Zapier. Usan el mismo formato de Shopify, así
        que sirven las mismas URLs que ya tenías configuradas allá.
      </p>

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((o) => !o)}
          aria-expanded={guideOpen}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-brand-ink">Facturación electrónica con Dataico</span>
            <span className="block text-xs text-brand-ink-soft mt-0.5">Cada venta pagada se factura sola ante la DIAN.</span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-brand-ink-soft shrink-0 transition-transform ${guideOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {guideOpen && (
          <ol className="px-5 pb-5 space-y-2.5 text-sm text-brand-ink-soft list-decimal list-inside marker:text-brand-ink marker:font-medium">
            <li>
              En Dataico, entra a la configuración de tu empresa → <span className="text-brand-ink">Configuración Shopify</span>. Deja
              marcado &ldquo;Enviar facturas automáticamente a la DIAN&rdquo; con <span className="font-mono text-xs text-brand-ink">financial_status</span> ={" "}
              <span className="font-mono text-xs text-brand-ink">paid</span> y tu numeración.
            </li>
            <li>
              Copia la <span className="text-brand-ink">Shopify url</span> que aparece ahí.
            </li>
            <li>
              Aquí abajo toca <span className="text-brand-ink">Crear webhook</span>, elige{" "}
              <span className="text-brand-ink">Actualización de pedido</span> y pega esa URL.
            </li>
            <li>
              Toca <span className="text-brand-ink">Enviar prueba</span>: llega como pedido anulado, así que Dataico no lo factura. Después
              revisa con una venta real pequeña que la factura aparezca en Dataico.
            </li>
          </ol>
        )}
      </Card>

      <Card>
        <div className="px-5 pt-4 pb-3">
          <p className="text-sm font-medium text-brand-ink">Webhooks</p>
          <p className="text-xs text-brand-ink-soft mt-0.5">
            Los pedidos hechos en modo de prueba de Wompi no se envían, para que nunca se facture algo que no fue una venta.
          </p>
        </div>
        <ul className="border-t border-brand-line divide-y divide-brand-line">
          {webhooks.map((w) => (
            <WebhookRow key={w.id} webhook={w} />
          ))}
        </ul>
        {creating ? (
          <div className={webhooks.length > 0 ? "border-t border-brand-line" : ""}>
            <CreateWebhookForm onDone={() => setCreating(false)} />
          </div>
        ) : (
          <div className={`px-5 py-3 ${webhooks.length > 0 ? "border-t border-brand-line" : ""}`}>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-sm font-medium text-brand-ink hover:text-brand-accent inline-flex items-center gap-2"
            >
              <span aria-hidden="true" className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs leading-none">
                +
              </span>
              Crear webhook
            </button>
          </div>
        )}
        <SigningSecret secret={signingSecret} />
      </Card>
    </div>
  );
}
