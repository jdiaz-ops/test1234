import { openWompiWidget } from "@/components/storefront/wompi-widget";

/// Lo que el checkout recibe de /api/tienda/{slug}/ordenes para mandar a
/// pagar — espejo de PaymentLaunch en src/server/payments/types.ts, sin
/// importar nada de servidor.
export type PaymentLaunch =
  | {
      kind: "wompi";
      provider: "WOMPI";
      widget: { publicKey: string; currency: string; amountInCents: number; reference: string; signature: string; redirectUrl: string };
      customerData: Record<string, string>;
      checkoutUrl: string;
    }
  | { kind: "redirect"; provider: string; url: string }
  | { kind: "form"; provider: "PAYU"; url: string; fields: Record<string, string> }
  | { kind: "epayco"; provider: "EPAYCO"; publicKey: string; test: boolean; data: Record<string, string> };

type EpaycoHandler = { open: (data: Record<string, string>) => void };
type EpaycoGlobal = { checkout: { configure: (config: { key: string; test: boolean }) => EpaycoHandler } };

declare global {
  interface Window {
    ePayco?: EpaycoGlobal;
  }
}

const EPAYCO_SCRIPT = "https://checkout.epayco.co/checkout.js";
let epaycoLoading: Promise<EpaycoGlobal> | null = null;

function loadEpayco(): Promise<EpaycoGlobal> {
  if (window.ePayco) return Promise.resolve(window.ePayco);
  if (epaycoLoading) return epaycoLoading;
  epaycoLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EPAYCO_SCRIPT;
    script.async = true;
    script.onload = () => (window.ePayco ? resolve(window.ePayco) : reject(new Error("ePayco no cargó")));
    script.onerror = () => {
      epaycoLoading = null;
      reject(new Error("No se pudo cargar ePayco"));
    };
    document.head.appendChild(script);
  });
  return epaycoLoading;
}

/// Formulario oculto que se envía por POST (PayU recibe así el cobro).
function submitForm(url: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.style.display = "none";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/// Manda al comprador a pagar según la pasarela de la marca. Devuelve
/// false solo cuando no se pudo abrir nada (el checkout muestra el error y
/// deja reintentar).
export async function launchPayment(launch: PaymentLaunch): Promise<boolean> {
  switch (launch.kind) {
    case "wompi": {
      const opened = await openWompiWidget(launch.widget, launch.customerData);
      if (!opened) window.location.assign(launch.checkoutUrl);
      return true;
    }
    case "redirect":
      window.location.assign(launch.url);
      return true;
    case "form":
      submitForm(launch.url, launch.fields);
      return true;
    case "epayco": {
      let epayco: EpaycoGlobal;
      try {
        epayco = await loadEpayco();
      } catch {
        return false;
      }
      const handler = epayco.checkout.configure({ key: launch.publicKey, test: launch.test });
      handler.open(launch.data);
      return true;
    }
  }
}
