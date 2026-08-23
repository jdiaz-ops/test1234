"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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
  shopifyConnected,
  wooConnected,
  onSaved,
}: {
  initial: FormState;
  shopifyConnected: boolean;
  wooConnected: boolean;
  onSaved?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Solo se puede elegir Shopify o WooCommerce — si la marca nunca conectó
  // nada, el perfil trae "OTHER" por defecto de la base de datos, y eso ya
  // no es una opción seleccionable.
  const [form, setForm] = useState<FormState>(() => ({
    ...initial,
    storeType: initial.storeType === "OTHER" ? "SHOPIFY" : initial.storeType,
  }));
  const [error, setError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  // Si ya está conectada, el formulario para conectar (de nuevo) empieza
  // escondido — si no, lo que se ve es "aquí está tu tienda conectada" y,
  // justo debajo, un formulario pidiendo conectarla otra vez, que confunde.
  const [showShopifyForm, setShowShopifyForm] = useState(!shopifyConnected);
  const [showWooForm, setShowWooForm] = useState(!wooConnected);

  // Resultado de la conexión automática — Shopify/WooCommerce nos regresan
  // aquí después de que la marca autorizó (o canceló/falló) el acceso.
  const [shopifyResult] = useState<{ status: "connected" | "error"; message?: string } | null>(() => {
    const status = searchParams.get("shopify");
    if (status === "connected") return { status: "connected" };
    if (status === "error") return { status: "error", message: searchParams.get("shopifyMessage") ?? undefined };
    return null;
  });
  const [wooResult] = useState<{ status: "connected" | "error"; message?: string } | null>(() => {
    const status = searchParams.get("woocommerce");
    if (status === "connected") return { status: "connected" };
    if (status === "error") return { status: "error", message: searchParams.get("woocommerceMessage") ?? undefined };
    return null;
  });

  useEffect(() => {
    if (shopifyResult || wooResult) onSaved?.();
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

  function connectWooCommerce() {
    const url = wooStoreUrl.trim().replace(/\/$/, "");
    if (!/^https:\/\/.+\..+/.test(url)) {
      setError("Escribe la URL completa de tu tienda, empezando por https://");
      return;
    }
    setError(null);
    const returnTo = encodeURIComponent(pathname);
    // Igual que con Shopify: esta ruta responde con un redirect hacia el
    // wp-admin de la marca, no hacia otra página de Next.js.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/integrations/woocommerce/connect?storeUrl=${encodeURIComponent(url)}&returnTo=${returnTo}`;
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
              <p className="text-xs font-medium text-green-700 bg-green-50 inline-block rounded-full px-2.5 py-1 mb-2">
                ✓ Conectada
              </p>
              <p className="text-sm text-brand-ink-soft mb-1">Tienda conectada</p>
              <p className="font-mono text-sm text-brand-ink break-all">{initial.storeUrl}</p>
              {!showShopifyForm && (
                <button
                  onClick={() => setShowShopifyForm(true)}
                  className="text-xs text-brand-accent hover:underline mt-3"
                >
                  Conectar otra tienda / reconectar
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-brand-ink-soft">
              Conéctate directo con tu tienda — nada de copiar tokens a mano. Solo autorizas el acceso
              desde Shopify y quedas conectada.
            </p>
          )}

          {showShopifyForm && (
            <>
              <div>
                <label className="block text-sm text-brand-ink mb-1">Dominio de tu tienda</label>
                <input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="tu-tienda.myshopify.com"
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  Lo encuentras en tu panel de Shopify, en la barra de direcciones, o en Configuración →
                  Dominios.
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
            </>
          )}
        </div>
      )}

      {form.storeType === "WOOCOMMERCE" && (
        <div className="space-y-4">
          {wooResult?.status === "connected" && (
            <p className="text-sm text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-2">
              ✓ Tu tienda WooCommerce quedó conectada — ya podemos detectar tus ventas automáticamente.
            </p>
          )}
          {wooResult?.status === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              No se pudo conectar: {wooResult.message ?? "intenta de nuevo."}
            </p>
          )}

          {wooConnected ? (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-xs font-medium text-green-700 bg-green-50 inline-block rounded-full px-2.5 py-1 mb-2">
                ✓ Conectada
              </p>
              <p className="text-sm text-brand-ink-soft mb-1">Tienda conectada</p>
              <p className="font-mono text-sm text-brand-ink break-all">{initial.storeUrl}</p>
              {!showWooForm && (
                <button onClick={() => setShowWooForm(true)} className="text-xs text-brand-accent hover:underline mt-3">
                  Conectar otra tienda / reconectar
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-brand-ink-soft">
              Conéctate directo con tu tienda — nada de copiar Consumer Key/Secret a mano. Solo autorizas
              el acceso desde tu propio wp-admin y quedas conectada.
            </p>
          )}

          {showWooForm && (
            <>
              <div>
                <label className="block text-sm text-brand-ink mb-1">URL de tu tienda</label>
                <input
                  value={wooStoreUrl}
                  onChange={(e) => setWooStoreUrl(e.target.value)}
                  placeholder="https://tu-tienda.com"
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  La URL completa de tu tienda — te vamos a mandar a tu propio wp-admin a autorizar el
                  acceso, ahí mismo.
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={connectWooCommerce}
                className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
              >
                Conectar con WooCommerce
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
