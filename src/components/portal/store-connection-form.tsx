"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StoreType = "SHOPIFY" | "WOOCOMMERCE" | "OTHER";

interface FormState {
  storeType: StoreType;
  storeUrl: string;
  shopifyAccessToken: string;
  wooConsumerKey: string;
  wooConsumerSecret: string;
}

export function StoreConnectionForm({
  initial,
  initialWebhookUrl,
  initialWebhookSecret,
  onSaved,
}: {
  initial: FormState;
  initialWebhookUrl: string | null;
  initialWebhookSecret: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/marca/tienda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const body = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo guardar.");
      return;
    }

    setWebhookUrl(body.webhookUrl);
    setWebhookSecret(body.webhookSecret);
    router.refresh();
    onSaved?.();
  }

  return (
    <div className="max-w-lg space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Plataforma</label>
          <select
            value={form.storeType}
            onChange={(e) => setForm({ ...form, storeType: e.target.value as StoreType })}
            className="input"
          >
            <option value="SHOPIFY">Shopify</option>
            <option value="WOOCOMMERCE">WooCommerce</option>
            <option value="OTHER">Otra / código con reporte manual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">URL de tu tienda</label>
          <input
            required
            type="url"
            value={form.storeUrl}
            onChange={(e) => setForm({ ...form, storeUrl: e.target.value })}
            placeholder="https://tu-tienda.com"
            className="input"
          />
        </div>

        {form.storeType === "SHOPIFY" && (
          <div>
            <label className="block text-sm text-brand-ink mb-1">Access Token (Admin API)</label>
            <input
              type="password"
              value={form.shopifyAccessToken}
              onChange={(e) => setForm({ ...form, shopifyAccessToken: e.target.value })}
              placeholder="shpat_..."
              className="input"
            />
            <p className="text-xs text-brand-ink-soft mt-1">
              Se crea en tu tienda desde Configuración → Apps y canales de venta → Desarrollar apps.
              Necesita permisos de lectura/escritura de Price rules y Discounts.
            </p>
          </div>
        )}

        {form.storeType === "WOOCOMMERCE" && (
          <>
            <div>
              <label className="block text-sm text-brand-ink mb-1">Consumer Key</label>
              <input
                type="password"
                value={form.wooConsumerKey}
                onChange={(e) => setForm({ ...form, wooConsumerKey: e.target.value })}
                placeholder="ck_..."
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-brand-ink mb-1">Consumer Secret</label>
              <input
                type="password"
                value={form.wooConsumerSecret}
                onChange={(e) => setForm({ ...form, wooConsumerSecret: e.target.value })}
                placeholder="cs_..."
                className="input"
              />
            </div>
            <p className="text-xs text-brand-ink-soft -mt-2">
              Se crean en WooCommerce → Ajustes → Avanzado → REST API, con permisos de Lectura/Escritura.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>

      {webhookUrl && webhookSecret && (
        <div className="border border-brand-line rounded-2xl p-5">
          <h2 className="font-display font-semibold text-brand-ink mb-2">
            Último paso: activa el webhook
          </h2>
          <p className="text-sm text-brand-ink-soft mb-4">
            Pega esta URL en tu tienda para que las ventas y reembolsos se detecten automáticamente.
            {form.storeType === "SHOPIFY"
              ? " Configuración → Notificaciones → Webhooks (crea uno para \"Creación de pedido\" y otro para \"Creación de reembolso\", formato JSON)."
              : " WooCommerce → Ajustes → Avanzado → Webhooks (crea uno para \"Pedido creado\" y otro para \"Pedido actualizado\")."}
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-mono text-brand-ink-soft mb-1">URL del webhook</p>
              <code className="block text-xs bg-brand-cream rounded-lg px-3 py-2 break-all">
                {webhookUrl}
              </code>
            </div>
            <div>
              <p className="text-xs font-mono text-brand-ink-soft mb-1">
                Secreto {form.storeType === "SHOPIFY" ? "(clave del webhook)" : "(Secret)"}
              </p>
              <code className="block text-xs bg-brand-cream rounded-lg px-3 py-2 break-all">
                {webhookSecret}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
