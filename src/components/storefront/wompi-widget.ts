/// Ventana de pago de Wompi (WidgetCheckout): se abre encima del checkout
/// apenas el comprador toca "Pagar ahora", con sus datos ya llenos. Es la
/// integración que documenta Wompi para abrir el pago desde un botón
/// propio — ver https://docs.wompi.co/docs/colombia/widget-checkout-web/
/// Reemplaza al link directo a checkout.wompi.co/p/, que el firewall de
/// Wompi bloqueaba con un 403. Ver conversación del 2026-10-01.

export type WompiParams = {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
};

type WidgetResult = { transaction?: { id?: string; status?: string } };

type WidgetCheckoutCtor = new (config: Record<string, unknown>) => {
  open: (callback: (result: WidgetResult) => void) => void;
};

declare global {
  interface Window {
    WidgetCheckout?: WidgetCheckoutCtor;
  }
}

const SCRIPT_SRC = "https://checkout.wompi.co/widget.js";
let loading: Promise<WidgetCheckoutCtor> | null = null;

function loadWidget(): Promise<WidgetCheckoutCtor> {
  if (window.WidgetCheckout) return Promise.resolve(window.WidgetCheckout);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.WidgetCheckout ? resolve(window.WidgetCheckout) : reject(new Error("WidgetCheckout no cargó")));
    script.onerror = () => {
      loading = null;
      reject(new Error("No se pudo cargar Wompi"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/// Abre la ventana de Wompi. Cuando el pago termina (aprobado o no) lleva
/// a la página del pedido con el id de la transacción, igual que el
/// redirect de Wompi. Si la ventana no carga, devuelve false.
export async function openWompiWidget(params: WompiParams, customerData: Record<string, string>) {
  let Widget: WidgetCheckoutCtor;
  try {
    Widget = await loadWidget();
  } catch {
    return false;
  }
  const checkout = new Widget({
    currency: params.currency,
    amountInCents: params.amountInCents,
    reference: params.reference,
    publicKey: params.publicKey,
    signature: { integrity: params.signature },
    redirectUrl: params.redirectUrl,
    customerData,
  });
  checkout.open((result) => {
    const id = result?.transaction?.id;
    window.location.assign(id ? `${params.redirectUrl}?id=${encodeURIComponent(id)}` : params.redirectUrl);
  });
  return true;
}
