"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// La conexión automática de Shopify (OAuth) queda en pausa mientras la app
// de Marcolini no esté aprobada en la Shopify App Store — Shopify no deja
// instalar por OAuth en una tienda real hasta pasar esa revisión (ver
// conversación del 2026-08-27). El código de esa conexión sigue completo
// acá abajo, sin tocar — apagado solo con este flag, para prender de
// vuelta con una sola línea en cuanto la app quede aprobada. Mientras
// tanto, la marca conecta pegando un token de una app privada que ella
// misma crea en su propio admin de Shopify (ver las instrucciones en el
// JSX) — ese camino no depende de ninguna revisión de Shopify, porque la
// app privada vive adentro de su propia tienda.
const SHOPIFY_OAUTH_ENABLED = false;

/// Los tres alcances que la marca debe marcar al crear su app privada — en
/// un solo string separado por comas porque así es como Shopify espera
/// pegarlos en "Configurar alcances de API de Admin".
const SHOPIFY_MANUAL_SCOPES = "write_price_rules,read_orders,read_products";

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
  const [error, setError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  // Conexión manual de Shopify (mientras SHOPIFY_OAUTH_ENABLED es false) —
  // la marca pega el dominio y el token de acceso de la app privada que
  // creó en su propio admin de Shopify.
  const [manualDomain, setManualDomain] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [copiedScopes, setCopiedScopes] = useState(false);
  // Si ya está conectada, el formulario para conectar (de nuevo) empieza
  // escondido — si no, lo que se ve es "aquí está tu tienda conectada" y,
  // justo debajo, un formulario pidiendo conectarla otra vez, que confunde.
  const [showShopifyForm, setShowShopifyForm] = useState(!shopifyConnected);
  const [showWooForm, setShowWooForm] = useState(!wooConnected);

  // Resultado de la conexión automática — Shopify/WooCommerce nos regresan
  // aquí después de que la marca autorizó (o canceló/falló) el acceso.
  const [shopifyResult] = useState<{
    status: "connected" | "error";
    message?: string;
  } | null>(() => {
    const status = searchParams.get("shopify");
    if (status === "connected") return { status: "connected" };
    if (status === "error")
      return {
        status: "error",
        message: searchParams.get("shopifyMessage") ?? undefined,
      };
    return null;
  });
  const [wooResult] = useState<{
    status: "connected" | "error";
    message?: string;
  } | null>(() => {
    const status = searchParams.get("woocommerce");
    if (status === "connected") return { status: "connected" };
    if (status === "error")
      return {
        status: "error",
        message: searchParams.get("woocommerceMessage") ?? undefined,
      };
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
      setError(
        "Escribe el dominio completo de tu tienda, terminado en .myshopify.com",
      );
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

  async function connectShopifyManual() {
    const domain = manualDomain.trim().toLowerCase();
    const token = manualToken.trim();
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
      setError(
        "Escribe el dominio completo de tu tienda, terminado en .myshopify.com",
      );
      return;
    }
    if (!token) {
      setError(
        "Pega el token de acceso a la API de Admin (empieza con shpat_).",
      );
      return;
    }
    setError(null);
    setManualSaving(true);
    try {
      const res = await fetch("/api/marca/tienda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeType: "SHOPIFY",
          storeUrl: `https://${domain}`,
          shopifyAccessToken: token,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error ?? "No se pudo conectar — revisa el dominio y el token.",
        );
        return;
      }
      setManualSuccess(true);
      setManualToken("");
      router.refresh();
      onSaved?.();
    } catch {
      setError("No se pudo conectar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setManualSaving(false);
    }
  }

  /// Copia al portapapeles y muestra "Copiado ✓" un par de segundos. Si el
  /// navegador bloquea el portapapeles (poco común), el texto sigue visible
  /// al lado del botón para copiarlo a mano — no hace falta manejar el error.
  async function copyText(text: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencioso a propósito — ver comentario arriba.
    }
  }

  // Solo con el dominio ya escrito podemos armar el link directo a la
  // pantalla de "Desarrollar apps" de esa tienda — por eso el dominio va
  // primero en el formulario, antes de las instrucciones.
  const manualDomainClean = manualDomain.trim().toLowerCase();
  const manualDomainValid = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(
    manualDomainClean,
  );
  const shopifyDevelopAppsUrl = manualDomainValid
    ? `https://admin.shopify.com/store/${manualDomainClean.replace(/\.myshopify\.com$/, "")}/settings/apps/development`
    : null;

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
          onChange={(e) =>
            setForm({ ...form, storeType: e.target.value as StoreType })
          }
          className="input"
        >
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </div>

      {form.storeType === "SHOPIFY" && (
        <div className="space-y-4">
          {SHOPIFY_OAUTH_ENABLED && shopifyResult?.status === "connected" && (
            <p className="text-sm text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-2">
              ✓ Tu tienda Shopify quedó conectada — ya podemos detectar tus
              ventas automáticamente.
            </p>
          )}
          {SHOPIFY_OAUTH_ENABLED && shopifyResult?.status === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              No se pudo conectar:{" "}
              {shopifyResult.message ?? "intenta de nuevo."}
            </p>
          )}
          {!SHOPIFY_OAUTH_ENABLED && manualSuccess && (
            <p className="text-sm text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-2">
              ✓ Tu tienda Shopify quedó conectada — ya podemos detectar tus
              ventas automáticamente.
            </p>
          )}

          {shopifyConnected ? (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-xs font-medium text-green-700 bg-green-50 inline-block rounded-full px-2.5 py-1 mb-2">
                ✓ Conectada
              </p>
              <p className="text-sm text-brand-ink-soft mb-1">
                Tienda conectada
              </p>
              <p className="font-mono text-sm text-brand-ink break-all">
                {initial.storeUrl}
              </p>
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
              {SHOPIFY_OAUTH_ENABLED
                ? "Conéctate directo con tu tienda — nada de copiar tokens a mano. Solo autorizas el acceso desde Shopify y quedas conectada."
                : "Sigue estos pasos para conectar tu tienda Shopify. Necesitarás las credenciales de acceso a tu cuenta de Shopify."}
            </p>
          )}

          {showShopifyForm && SHOPIFY_OAUTH_ENABLED && (
            <>
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Dominio de tu tienda
                </label>
                <input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="tu-tienda.myshopify.com"
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  Lo encuentras en tu panel de Shopify, en la barra de
                  direcciones, o en Configuración → Dominios.
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

          {showShopifyForm && !SHOPIFY_OAUTH_ENABLED && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Dominio de tu tienda
                </label>
                <input
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  placeholder="tu-tienda.myshopify.com"
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  Lo encuentras en tu panel de Shopify, en la barra de
                  direcciones, o en Configuración → Dominios.
                </p>
              </div>

              <ol className="text-sm text-brand-ink-soft list-decimal list-inside space-y-3">
                <li>
                  Ve a{" "}
                  <strong>
                    Configuración → Apps y canales de venta → Desarrollar apps
                  </strong>{" "}
                  en tu admin de Shopify.
                  {shopifyDevelopAppsUrl && (
                    <a
                      href={shopifyDevelopAppsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block mt-1 text-xs font-medium text-brand-accent hover:underline"
                    >
                      Abrir esta pantalla en tu tienda →
                    </a>
                  )}
                </li>
                <li>
                  Clic en <strong>Crear una app</strong>. En el nombre pon:
                  <span className="flex items-center gap-2 mt-1">
                    <code className="bg-brand-surface border border-brand-line rounded px-2 py-1 text-xs">
                      Marcolini
                    </code>
                    <button
                      type="button"
                      onClick={() => copyText("Marcolini", setCopiedName)}
                      className="text-xs text-brand-accent hover:underline"
                    >
                      {copiedName ? "Copiado ✓" : "Copiar"}
                    </button>
                  </span>
                </li>
                <li>
                  En <strong>Configurar alcances de API de Admin</strong>, copia
                  lo siguiente y pégalo ahí:
                  <span className="flex items-center gap-2 mt-1">
                    <code className="bg-brand-surface border border-brand-line rounded px-2 py-1 text-xs break-all">
                      {SHOPIFY_MANUAL_SCOPES}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(SHOPIFY_MANUAL_SCOPES, setCopiedScopes)
                      }
                      className="text-xs text-brand-accent hover:underline shrink-0"
                    >
                      {copiedScopes ? "Copiado ✓" : "Copiar"}
                    </button>
                  </span>
                </li>
                <li>
                  Clic en <strong>Instalar app</strong> (arriba a la derecha) —
                  te va a dar un{" "}
                  <strong>Token de acceso a la API de Admin</strong>, empieza
                  con <code>shpat_</code> y solo se muestra una vez. Cópialo y
                  pégalo abajo.
                </li>
              </ol>

              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  Token de acceso a la API de Admin
                </label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="shpat_..."
                  className="input"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={connectShopifyManual}
                disabled={manualSaving}
                className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {manualSaving ? "Conectando..." : "Conectar con Shopify"}
              </button>
            </div>
          )}
        </div>
      )}

      {form.storeType === "WOOCOMMERCE" && (
        <div className="space-y-4">
          {wooResult?.status === "connected" && (
            <p className="text-sm text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-2">
              ✓ Tu tienda WooCommerce quedó conectada — ya podemos detectar tus
              ventas automáticamente.
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
              <p className="text-sm text-brand-ink-soft mb-1">
                Tienda conectada
              </p>
              <p className="font-mono text-sm text-brand-ink break-all">
                {initial.storeUrl}
              </p>
              {!showWooForm && (
                <button
                  onClick={() => setShowWooForm(true)}
                  className="text-xs text-brand-accent hover:underline mt-3"
                >
                  Conectar otra tienda / reconectar
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-brand-ink-soft">
              Conéctate directo con tu tienda — nada de copiar Consumer
              Key/Secret a mano. Solo autorizas el acceso desde tu propio
              wp-admin y quedas conectada.
            </p>
          )}

          {showWooForm && (
            <>
              <div>
                <label className="block text-sm text-brand-ink mb-1">
                  URL de tu tienda
                </label>
                <input
                  value={wooStoreUrl}
                  onChange={(e) => setWooStoreUrl(e.target.value)}
                  placeholder="https://tu-tienda.com"
                  className="input"
                />
                <p className="text-xs text-brand-ink-soft mt-1">
                  La URL completa de tu tienda — te vamos a mandar a tu propio
                  wp-admin a autorizar el acceso, ahí mismo.
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
