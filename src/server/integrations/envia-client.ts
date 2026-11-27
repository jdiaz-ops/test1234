/// Cliente de la API de Envia.com: cotizar, crear y anular guías, y
/// rastrearlas. Las rutas y los campos son los del paquete oficial de Envia
/// (@envia/envia-mcp: /ship/rate/, /ship/generate/, /ship/generaltrack/,
/// /ship/cancel/, /available-carrier/) y los de Colombia (ciudad con
/// código DANE, /locate) los del módulo de Magento citado en
/// lib/envia-address.ts. Ver envia-service.ts.

const BASES = {
  production: { shipping: "https://api.envia.com", queries: "https://queries.envia.com" },
  sandbox: { shipping: "https://api-test.envia.com", queries: "https://queries-test.envia.com" },
} as const;

const TIMEOUT_MS = 25_000;

export class EnviaError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "EnviaError";
  }
}

export type EnviaAuth = { apiToken: string; sandbox: boolean };

/// Envia no aceptó la llave (a diferencia de un error suyo o de red).
export function isKeyRejected(err: unknown): boolean {
  return err instanceof EnviaError && (err.status === 401 || err.status === 403);
}

export type EnviaAddress = {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  street: string;
  /// El número de la dirección (o "S/N"), aparte de la calle.
  number: string;
  /// El barrio.
  district: string;
  /// NIT o cédula (las transportadoras de Colombia lo piden al crear la guía).
  identificationNumber?: string;
  /// En Colombia, el código DANE de 8 dígitos del municipio.
  city: string;
  state: string;
  country: "CO";
  postalCode: string;
  reference?: string;
};

export type EnviaShipment = {
  origin: EnviaAddress;
  destination: EnviaAddress;
  package: {
    content: string;
    /// En pesos.
    declaredValue: number;
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
};

type Json = Record<string, unknown> | null;

function errorMessage(status: number, json: Json): string {
  const error = json?.error;
  const detail = [
    typeof error === "object" && error ? (error as Record<string, unknown>).message : null,
    typeof error === "object" && error ? (error as Record<string, unknown>).description : null,
    json?.message,
    typeof error === "string" ? error : null,
  ].find((d): d is string => typeof d === "string" && d.trim() !== "");
  if (status === 401 || status === 403) {
    return "Envia no aceptó la llave: revisa que esté bien copiada y que sea de la cuenta correcta (producción o pruebas).";
  }
  if (status === 402) return "No tienes saldo suficiente en Envia. Recarga tu cuenta y vuelve a intentarlo.";
  if (status === 429) return "Envia está recibiendo muchas consultas. Espera un momento y vuelve a intentarlo.";
  if (status >= 500) return "Envia tiene un problema en este momento. Intenta de nuevo en unos minutos.";
  // Envia pega todo lo que se le mandó ("…, data: {"origin":…}"): sobra.
  const clean = detail?.replace(/,?\s*data:\s*[[{][\s\S]*$/, "").trim();
  return clean ? `Envia: ${clean.slice(0, 200)}` : `Envia respondió con un error (${status}).`;
}

async function call(
  api: "shipping" | "queries",
  path: string,
  options: { auth: EnviaAuth | null; sandbox?: boolean; method: "GET" | "POST"; body?: unknown },
): Promise<Json> {
  const sandbox = options.auth?.sandbox ?? options.sandbox ?? false;
  const url = `${BASES[sandbox ? "sandbox" : "production"][api]}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method,
      headers: {
        ...(options.auth ? { Authorization: `Bearer ${options.auth.apiToken}` } : {}),
        "Content-Type": "application/json",
        Accept: "application/json",
        // Sin un User-Agent propio, Cloudflare (delante de Envia) puede
        // rechazar la petición.
        "User-Agent": "Marcolini/1.0 (+https://marcolini.lat)",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new EnviaError("Envia no respondió. Intenta de nuevo en un momento.");
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as Json;
  // Envia también avisa errores con 200 y {"meta":"error"}.
  if (!res.ok || json?.meta === "error") throw new EnviaError(errorMessage(res.status, json), res.status);
  return json;
}

const rows = (json: Json): Record<string, unknown>[] =>
  Array.isArray(json?.data) ? (json.data as unknown[]).filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null) : [];

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;

/// Transportadoras de la cuenta para envíos dentro de Colombia. Sirve
/// también para probar la llave.
export async function listCarriers(auth: EnviaAuth): Promise<{ code: string; name: string | null }[]> {
  const json = await call("queries", "/available-carrier/CO/0", { auth, method: "GET" });
  const seen = new Set<string>();
  return rows(json).flatMap((r) => {
    const code = text(r.carrier) ?? text(r.name);
    if (!code || seen.has(code.toLowerCase())) return [];
    seen.add(code.toLowerCase());
    return [{ code, name: r.carrier ? text(r.name) : text(r.description) }];
  });
}

function shipmentBody(shipment: EnviaShipment) {
  const p = shipment.package;
  return {
    origin: shipment.origin,
    destination: shipment.destination,
    packages: [
      {
        type: "box",
        content: p.content,
        amount: 1,
        declaredValue: p.declaredValue,
        weight: p.weightKg,
        weightUnit: "KG",
        lengthUnit: "CM",
        dimensions: { length: p.lengthCm, width: p.widthCm, height: p.heightCm },
      },
    ],
  };
}

export type EnviaRate = {
  carrier: string;
  carrierName: string | null;
  service: string;
  serviceName: string | null;
  deliveryEstimate: string | null;
  totalPrice: number;
  currency: string;
};

/// Tarifas de una transportadora (Envia cotiza una por petición).
export async function rateCarrier(auth: EnviaAuth, shipment: EnviaShipment, carrier: string): Promise<EnviaRate[]> {
  const json = await call("shipping", "/ship/rate/", {
    auth,
    method: "POST",
    body: { ...shipmentBody(shipment), shipment: { type: 1, carrier: carrier.toLowerCase() } },
  });
  return rows(json).flatMap((r) => {
    const totalPrice = Number(r.totalPrice);
    const service = text(r.service);
    if (!service || !Number.isFinite(totalPrice) || totalPrice <= 0) return [];
    return [
      {
        carrier: text(r.carrier) ?? carrier,
        carrierName: text(r.carrierDescription),
        service,
        serviceName: text(r.serviceDescription),
        deliveryEstimate: text(r.deliveryEstimate),
        totalPrice,
        currency: text(r.currency) ?? "COP",
      },
    ];
  });
}

export type EnviaLabel = {
  carrier: string;
  service: string;
  trackingNumber: string;
  labelUrl: string | null;
  trackUrl: string | null;
  totalPrice: number | null;
};

/// Tamaños de la guía, en orden: hoja carta (H la Cosedora imprime todo en
/// papel carta) y, si la transportadora no la da en carta, 4x6.
export const LABEL_SIZES = ["PAPER_LETTER", "PAPER_4X6", "STOCK_4X6"] as const;

/// Compra la guía: se cobra del saldo de la cuenta de Envia de la marca.
/// Para crearla (no para cotizar) Envia exige `settings` (formato y tamaño
/// de impresión): si rechaza el tamaño, se prueba con el siguiente; un
/// rechazo así no crea guía.
export async function generateLabel(
  auth: EnviaAuth,
  shipment: EnviaShipment,
  carrier: string,
  service: string,
): Promise<EnviaLabel> {
  let json: Json = null;
  for (const [i, printSize] of LABEL_SIZES.entries()) {
    try {
      json = await call("shipping", "/ship/generate/", {
        auth,
        method: "POST",
        body: {
          ...shipmentBody(shipment),
          shipment: { type: 1, carrier: carrier.toLowerCase(), service },
          settings: { printFormat: "PDF", printSize, currency: "COP" },
        },
      });
      break;
    } catch (err) {
      const sizeRejected =
        err instanceof EnviaError && (err.status === 400 || err.status === 422) && /print|size|tama/i.test(err.message);
      if (!sizeRejected || i === LABEL_SIZES.length - 1) throw err;
    }
  }
  const row = rows(json)[0];
  const trackingNumber = text(row?.trackingNumber);
  if (!row || !trackingNumber) {
    throw new EnviaError(
      "Envia no devolvió el número de guía. Revisa en tu cuenta de Envia si la guía se creó antes de intentarlo otra vez.",
    );
  }
  const totalPrice = Number(row.totalPrice);
  return {
    carrier: text(row.carrier) ?? carrier,
    service: text(row.service) ?? service,
    trackingNumber,
    labelUrl: text(row.label),
    trackUrl: text(row.trackUrl),
    totalPrice: Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice : null,
  };
}

/// Estado actual de cada guía ("Created", "In Transit", "Delivered"…).
export async function trackShipments(
  auth: EnviaAuth,
  trackingNumbers: string[],
): Promise<{ trackingNumber: string; status: string | null }[]> {
  if (trackingNumbers.length === 0) return [];
  const json = await call("shipping", "/ship/generaltrack/", { auth, method: "POST", body: { trackingNumbers } });
  return rows(json).flatMap((r) => {
    const trackingNumber = text(r.trackingNumber);
    return trackingNumber ? [{ trackingNumber, status: text(r.status) }] : [];
  });
}

/// Anula la guía; Envia devuelve el saldo si la transportadora lo permite.
export async function cancelLabel(
  auth: EnviaAuth,
  carrier: string,
  trackingNumber: string,
): Promise<{ balanceReturned: boolean | null }> {
  const json = await call("shipping", "/ship/cancel/", {
    auth,
    method: "POST",
    body: { carrier: carrier.toLowerCase(), trackingNumber },
  });
  const data = json?.data as Record<string, unknown> | undefined;
  return { balanceReturned: typeof data?.balanceReturned === "boolean" ? data.balanceReturned : null };
}

/// Busca en Envia el código DANE de una ciudad escrita a mano, cuando no
/// la reconocemos nosotros. No usa la llave.
export async function locateCity(
  sandbox: boolean,
  city: string,
  state: string,
): Promise<{ city: string; state: string; name: string | null } | null> {
  try {
    const json = await call("shipping", "/locate", {
      auth: null,
      sandbox,
      method: "POST",
      body: { city, state, country: "CO" },
    });
    const found = (json?.city ? json : json?.data) as Record<string, unknown> | undefined;
    const code = text(found?.city);
    if (!found || !code || !/^\d{5,10}$/.test(code)) return null;
    return { city: code, state: text(found.state) ?? state, name: text(found.name) };
  } catch {
    return null;
  }
}
