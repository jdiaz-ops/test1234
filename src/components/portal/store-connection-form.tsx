"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
  shopifyConnected,
  onSaved,
}: {
  initial: FormState;
  initialWebhookUrl: string | null;
  initialWebhookSecret: string | null;
  shopifyConnected: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Solo se puede elegir Shopify o WooCommerce — si la marca nunca conectó
  // nada, el perfil trae "OTHER" por defecto de la base de datos, y eso ya
  // no es una opción seleccionable.
  const [form, setForm] = useState<FormState>(() => ({
    ...initial,
    storeType: initial.storeType === "OTHER" ? "SHOPIFY" : initial.storeType,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret);
  const [shopDomain, setShopDomain] = useState("");

  // Resultado de la conexión automática con Shopify — Shopify nos regresa
  // aquí después de que la marca autorizó (o canceló/falló) el acceso.
  const [shopifyResult] = useState<{ status: "connected" | "error"; message?: string } | null>(() => {
      const status = searchParams.get("shopify");
      if (status === "connected") return { status: "connected" };
      if (status === "error") return { status: "error", message: searchParams.get("shopifyMessage") ?? undefined };
      return null;
    }
  );

  useEffect(() => {
    if (shopifyResult) onSaved?.();
    // Solo debe reaccionar una vez, al montar con el resultado que trae la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectShopify() {
    const domain = shopDomain.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
      setError("Escribe el dominio completo de tu tienda, terminado en .myshopify.com");
      return;
    }
    setError(null);
    const returnTo = encodeURIComponent(pathname);
    // Navegación completa a propósito: esta ruta responde con un redirect
    // hacia un dominio externo (Shopify), no hacia otra página de Next.js —
    // router.push no sirve para eso.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(domain)}&returnTo=${returnTo}`;
  }

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
      <div>
        <label className="block text-sm text-brand-ink mb-1">Plataforma</label>
        <select
          value={form.storeType}
          onChange={(e) => setForm({ ...form, storeType: e.target.value as StoreType })}
          className="input"
        >
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </div>

      {form.storeType === "SHOPIFY" && (
        <div className="space-y-4">
          {shopifyResult?.status === "connected" && (
            <p className="text-sm text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-2">
              ✓ Tu tienda Shopify quedó conectada — ya podemos detectar tus ventas automáticamente.
            </p>
          )}
          {shopifyResult?.status === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              No se pudo conectar: {shopifyResult.message ?? "intenta de nuevo."}
            </p>
          )}

          {shopifyConnected ? (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-sm text-brand-ink-soft mb-1">Tienda conectada</p>
              <p className="font-mono text-sm text-brand-ink break-all">{initial.storeUrl}</p>
              <button
                onClick={() => document.getElementById("shopify-reconnect")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs text-brand-accent hover:underline mt-3"
              >
                Conectar otra tienda / reconectar
              </button>
            </div>
          ) : (
            <p className="text-sm text-brand-ink-soft">
              Conéctate directo con tu tienda — nada de copiar tokens a mano. Solo autorizas el acceso
              desde Shopify y quedas conectada.
            </p>
          )}

          <div id="shopify-reconnect">
            <label className="block text-sm text-brand-ink mb-1">Dominio de tu tienda</label>
            <input
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="tu-tienda.myshopify.com"
              className="input"
            />
            <p className="text-xs text-brand-ink-soft mt-1">
              Lo encuentras en tu panel de Shopify, en la barra de direcciones, o en Configuración → Dominios.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={connectShopify}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
          >
            Conectar con Shopify
          </button>
        </div>
      )}

      {form.storeType === "WOOCOMMERCE" && (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {webhookUrl && webhookSecret && form.storeType === "WOOCOMMERCE" && (
        <div className="border border-brand-line rounded-2xl p-5">
          <h2 className="font-display font-semibold text-brand-ink mb-2">Último paso: activa el webhook</h2>
          <p className="text-sm text-brand-ink-soft mb-4">
            Pega esta URL en tu tienda para que las ventas y reembolsos se detecten automáticamente.
            WooCommerce → Ajustes → Avanzado → Webhooks (crea uno para &quot;Pedido creado&quot; y otro
            para &quot;Pedido actualizado&quot;).
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-mono text-brand-ink-soft mb-1">URL del webhook</p>
              <code className="block text-xs bg-brand-cream rounded-lg px-3 py-2 break-all">{webhookUrl}</code>
            </div>
            <div>
              <p className="text-xs font-mono text-brand-ink-soft mb-1">Secreto (Secret)</p>
              <code className="block text-xs bg-brand-cream rounded-lg px-3 py-2 break-all">{webhookSecret}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
