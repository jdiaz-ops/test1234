/// Pasarelas con las que una marca puede cobrar en su tienda Marcolini —
/// cada una con SU cuenta: las llaves las pega la marca en Pagos y la
/// plata le llega directo, Marcolini nunca la recibe. Este archivo no toca
/// la base ni Next: lo usan el checkout (qué mostrar), la página de Pagos
/// (qué campos pedir) y los módulos de servidor en src/server/payments.
/// Ver conversación del 2026-10-18 ("no puedo obligar a que abra Wompi").

export type PaymentProviderId = "WOMPI" | "MERCADO_PAGO" | "PAYU" | "EPAYCO" | "BOLD";
export type PaymentModeId = "TEST" | "PRODUCTION";

/// Dónde viven las llaves de una pasarela: un juego por entorno (prueba y
/// producción) o uno solo para los dos — ePayco usa las mismas llaves y el
/// modo de prueba es una bandera al abrir su ventana de pago.
export type CredentialScope = PaymentModeId | "SHARED";

export type CredentialField = {
  key: string;
  label: string;
  /// Se guarda y se muestra enmascarada: nunca viaja completa al navegador.
  secret: boolean;
  optional?: boolean;
  /// Cómo suele empezar, solo para avisar si se pegó en el campo equivocado.
  prefix?: Partial<Record<PaymentModeId, string>>;
  help?: string;
};

export type PaymentMethodInfo = { name: string; detail: string; mark: string; markClass: string };

export type PaymentProviderSpec = {
  id: PaymentProviderId;
  name: string;
  /// Quién está detrás, en una o dos frases, para "Acerca de".
  about: string;
  signupUrl: string;
  /// Dónde encuentra la marca sus llaves dentro del panel de la pasarela.
  keysHint: string;
  scopes: "PER_MODE" | "SHARED";
  fields: CredentialField[];
  /// Medios que suele ofrecer en Colombia — los que ve el comprador
  /// dependen de lo que la marca tenga activo en su propia cuenta.
  methods: PaymentMethodInfo[];
  /// Etiquetas cortas para el checkout (las tres primeras y "+N").
  badges: string[];
  /// URL fija que la marca pega en el panel de la pasarela para que avise
  /// cada pago (Wompi, Mercado Pago, Bold) — null cuando la URL de aviso
  /// va dentro de cada cobro (PayU, ePayco) y no hay nada que pegar.
  webhook: { path: (brandId: string) => string; where: string } | null;
  /// Dónde se devuelve el dinero de un pedido (el reembolso se hace en la
  /// pasarela; en Marcolini solo se registra).
  refundHint: string;
  /// Qué pasa al tocar "Pagar ahora".
  checkoutHint: string;
  /// Nota para el modo de prueba (cómo se prueba sin cobrar de verdad).
  testHint: string;
  /// Qué hacer, en pasos cortos, en el paso "Conecta tus pagos" del
  /// Dashboard (pedido del 2026-10-19: "para cada uno las instrucciones
  /// cortas de qué hacer"). "Tu URL de avisos" es la de `webhook`. Solo
  /// las que se ofrecen hoy; las demás muestran keysHint/testHint.
  steps?: Record<PaymentModeId, string[]>;
};

const CARD = { mark: "CARD", markClass: "bg-slate-800 text-white" };
const PSE = { mark: "PSE", markClass: "bg-sky-100 text-sky-800" };
const NEQUI = { mark: "N", markClass: "bg-fuchsia-100 text-fuchsia-800" };
const BANCOLOMBIA = { mark: "B", markClass: "bg-yellow-100 text-yellow-900" };
const DAVIPLATA = { mark: "D", markClass: "bg-red-100 text-red-700" };
const CASH = { mark: "$", markClass: "bg-emerald-100 text-emerald-800" };

export const PAYMENT_PROVIDERS: Record<PaymentProviderId, PaymentProviderSpec> = {
  WOMPI: {
    id: "WOMPI",
    name: "Wompi",
    about:
      "Wompi es la pasarela de pagos de Bancolombia. Cobras con tu propia cuenta: cada venta llega directo a ti y Wompi descuenta su tarifa por transacción según tu plan con ellos.",
    signupUrl: "https://comercios.wompi.co",
    keysHint: "En tu panel de Wompi, sección Desarrolladores.",
    scopes: "PER_MODE",
    fields: [
      { key: "publicKey", label: "Llave pública", secret: false, prefix: { TEST: "pub_test_", PRODUCTION: "pub_prod_" } },
      { key: "privateKey", label: "Llave privada", secret: true, prefix: { TEST: "prv_test_", PRODUCTION: "prv_prod_" } },
      {
        key: "eventsKey",
        label: "Eventos",
        secret: true,
        prefix: { TEST: "test_events_", PRODUCTION: "prod_events_" },
        help: "Con ella confirmamos que cada aviso de pago de verdad lo mandó Wompi.",
      },
      {
        key: "integrityKey",
        label: "Integridad",
        secret: true,
        prefix: { TEST: "test_integrity_", PRODUCTION: "prod_integrity_" },
        help: "Firma el valor de cada cobro para que nadie lo pueda cambiar.",
      },
    ],
    methods: [
      { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express", ...CARD },
      { name: "PSE", detail: "Débito desde cualquier banco", ...PSE },
      { name: "Nequi", detail: "Pago desde la app", ...NEQUI },
      { name: "Bancolombia", detail: "Botón de pago y QR", ...BANCOLOMBIA },
      { name: "Daviplata", detail: "Pago desde la app", ...DAVIPLATA },
      { name: "Efectivo", detail: "Corresponsales Bancolombia", ...CASH },
    ],
    badges: ["Tarjetas", "PSE", "Nequi", "Bancolombia", "Daviplata", "Efectivo"],
    webhook: {
      path: () => "/api/webhooks/wompi",
      where: "Wompi → Desarrolladores → URL de eventos (en producción y en pruebas).",
    },
    refundHint: "tu panel de Wompi (Transacciones → la del pedido → Anular o reembolsar)",
    checkoutHint: "Al tocar Pagar ahora se abre Wompi para completar tu compra.",
    testHint: "Con las llaves de prueba de Wompi puedes hacer compras de ensayo con sus tarjetas de prueba.",
    steps: {
      PRODUCTION: [
        "Entra a comercios.wompi.co → Desarrolladores.",
        "Copia las 4 llaves de producción (pública, privada, eventos e integridad) y pégalas aquí.",
        "En «URL de eventos» de producción, pega tu URL de avisos (está abajo).",
        "Toca «Guardar y empezar a cobrar».",
      ],
      TEST: [
        "Entra a comercios.wompi.co → Desarrolladores.",
        "Copia las 4 llaves de pruebas (empiezan por pub_test_, prv_test_, test_events_ y test_integrity_) y pégalas aquí.",
        "En «URL de eventos» de pruebas, pega tu URL de avisos (está abajo).",
        "Toca «Guardar y probar» y haz una compra de ensayo con las tarjetas de prueba de Wompi.",
      ],
    },
  },
  MERCADO_PAGO: {
    id: "MERCADO_PAGO",
    name: "Mercado Pago",
    about:
      "Mercado Pago cobra con tarjetas, PSE y dinero en cuenta. Cobras con tu propia cuenta: cada venta llega a tu saldo de Mercado Pago y ellos descuentan su comisión.",
    signupUrl: "https://www.mercadopago.com.co/developers/panel/app",
    keysHint:
      "En mercadopago.com.co/developers → Tus integraciones → tu aplicación → Credenciales de producción (o de prueba) → Access Token.",
    scopes: "PER_MODE",
    fields: [
      { key: "accessToken", label: "Access Token", secret: true, prefix: { TEST: "TEST-", PRODUCTION: "APP_USR-" } },
      {
        key: "webhookSecret",
        label: "Clave secreta de Webhooks",
        secret: true,
        optional: true,
        help: "Opcional. Está en Webhooks → Configurar notificaciones. Con ella validamos la firma de cada aviso; sin ella igual confirmamos cada pago consultándolo en Mercado Pago.",
      },
    ],
    methods: [
      { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express", ...CARD },
      { name: "PSE", detail: "Débito desde cualquier banco", ...PSE },
      { name: "Dinero en Mercado Pago", detail: "Saldo de la cuenta del comprador", mark: "MP", markClass: "bg-sky-100 text-sky-800" },
      { name: "Efectivo", detail: "Efecty", ...CASH },
    ],
    badges: ["Tarjetas", "PSE", "Mercado Pago", "Efecty"],
    webhook: {
      path: (brandId) => `/api/webhooks/mercadopago/${brandId}`,
      where: "Mercado Pago → Tus integraciones → tu aplicación → Webhooks → URL (modo productivo y modo de prueba), evento Pagos.",
    },
    refundHint: "tu cuenta de Mercado Pago (Actividad → el cobro → Devolver dinero)",
    checkoutHint: "Al tocar Pagar ahora pasas a Mercado Pago para completar tu compra y vuelves a la tienda al terminar.",
    testHint:
      "Con el Access Token de prueba (empieza por TEST-) los cobros son de ensayo: Mercado Pago pide pagar con un usuario de prueba de tu aplicación.",
    steps: {
      PRODUCTION: [
        "Entra a mercadopago.com.co/developers → Tus integraciones y abre tu aplicación (o crea una).",
        "En «Credenciales de producción», copia el Access Token (empieza por APP_USR-) y pégalo aquí.",
        "En «Webhooks», pega tu URL de avisos (está abajo) en modo productivo y marca el evento «Pagos».",
        "Toca «Guardar y empezar a cobrar».",
      ],
      TEST: [
        "Entra a mercadopago.com.co/developers → Tus integraciones y abre tu aplicación (o crea una).",
        "En «Credenciales de prueba», copia el Access Token (empieza por TEST-) y pégalo aquí.",
        "En «Webhooks», pega tu URL de avisos (está abajo) en modo de prueba y marca el evento «Pagos».",
        "Toca «Guardar y probar» y paga con un usuario de prueba de tu aplicación (en «Cuentas de prueba»): con tu propia cuenta no se puede.",
      ],
    },
  },
  PAYU: {
    id: "PAYU",
    name: "PayU",
    about:
      "PayU cobra con tarjetas, PSE, Nequi y efectivo. Cobras con tu propia cuenta de PayU: cada venta llega a tu cuenta y PayU descuenta su comisión.",
    signupUrl: "https://colombia.payu.com/",
    keysHint: "En tu panel de PayU → Configuración → Configuración técnica.",
    scopes: "PER_MODE",
    fields: [
      { key: "merchantId", label: "ID de comercio (merchantId)", secret: false },
      { key: "accountId", label: "ID de cuenta (accountId)", secret: false },
      { key: "apiKey", label: "API Key", secret: true, help: "Firma cada cobro y cada aviso de pago." },
      {
        key: "apiLogin",
        label: "API Login",
        secret: true,
        optional: true,
        help: "Opcional. Con él consultamos en PayU los pedidos que quedaron pendientes para marcarlos como pagados solos.",
      },
    ],
    methods: [
      { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express, Diners", ...CARD },
      { name: "PSE", detail: "Débito desde cualquier banco", ...PSE },
      { name: "Nequi", detail: "Pago desde la app", ...NEQUI },
      { name: "Bancolombia", detail: "Botón de pago", ...BANCOLOMBIA },
      { name: "Efectivo", detail: "Efecty, SuRed, Baloto", ...CASH },
    ],
    badges: ["Tarjetas", "PSE", "Nequi", "Efectivo"],
    webhook: null,
    refundHint: "tu panel de PayU (Transacciones → la del pedido → Reembolsar)",
    checkoutHint: "Al tocar Pagar ahora pasas a PayU para completar tu compra y vuelves a la tienda al terminar.",
    testHint:
      "Puedes usar las credenciales públicas del sandbox de PayU (botón abajo) para hacer compras de ensayo con sus tarjetas de prueba.",
  },
  EPAYCO: {
    id: "EPAYCO",
    name: "ePayco",
    about:
      "ePayco (Davivienda) cobra con tarjetas, PSE, Nequi, Daviplata y efectivo. Cobras con tu propia cuenta: cada venta llega a ti y ePayco descuenta su comisión.",
    signupUrl: "https://epayco.com/",
    keysHint:
      "PUBLIC_KEY en ePayco → Integraciones → Llaves API. P_CUST_ID_CLIENTE y P_KEY en Configuración → Personalizaciones → Llaves secretas.",
    scopes: "SHARED",
    fields: [
      { key: "publicKey", label: "PUBLIC_KEY", secret: false },
      { key: "custId", label: "P_CUST_ID_CLIENTE", secret: false },
      { key: "pKey", label: "P_KEY", secret: true, help: "Con ella confirmamos que cada aviso de pago de verdad lo mandó ePayco." },
    ],
    methods: [
      { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express, Diners", ...CARD },
      { name: "PSE", detail: "Débito desde cualquier banco", ...PSE },
      { name: "Nequi", detail: "Pago desde la app", ...NEQUI },
      { name: "Daviplata", detail: "Pago desde la app", ...DAVIPLATA },
      { name: "Efectivo", detail: "Efecty, Baloto, Gana, SuRed", ...CASH },
    ],
    badges: ["Tarjetas", "PSE", "Nequi", "Daviplata", "Efectivo"],
    webhook: null,
    refundHint: "tu panel de ePayco (Transacciones → la del pedido → Reversar)",
    checkoutHint: "Al tocar Pagar ahora se abre ePayco para completar tu compra.",
    testHint: "Las mismas llaves sirven para probar: en modo de prueba la ventana de ePayco abre en su ambiente de pruebas y no cobra de verdad.",
    steps: {
      PRODUCTION: [
        "Entra a tu panel de ePayco → Integraciones → Llaves API y copia la PUBLIC_KEY.",
        "En Configuración → Personalizaciones → Llaves secretas, copia P_CUST_ID_CLIENTE y P_KEY.",
        "Pégalas aquí y toca «Guardar y empezar a cobrar». Con ePayco no hay URL que pegar.",
      ],
      TEST: [
        "Entra a tu panel de ePayco → Integraciones → Llaves API y copia la PUBLIC_KEY.",
        "En Configuración → Personalizaciones → Llaves secretas, copia P_CUST_ID_CLIENTE y P_KEY.",
        "Pégalas aquí y toca «Guardar y probar». Son las mismas llaves de cobrar: en modo de prueba ePayco no cobra de verdad.",
      ],
    },
  },
  BOLD: {
    id: "BOLD",
    name: "Bold",
    about:
      "Bold cobra con tarjetas, PSE, Nequi, Daviplata y botón Bancolombia. Cobras con tu propia cuenta de Bold: cada venta llega a ti y Bold descuenta su comisión.",
    signupUrl: "https://bold.co/",
    keysHint: "En tu panel de Bold → Integraciones → Llaves de integración (hay un juego de producción y otro de pruebas).",
    scopes: "PER_MODE",
    fields: [
      { key: "apiKey", label: "Llave de identidad", secret: true, help: "Crea cada link de pago en tu cuenta de Bold." },
      {
        key: "secretKey",
        label: "Llave secreta",
        secret: true,
        optional: true,
        help: "Opcional. Con ella validamos la firma de cada aviso de Bold; sin ella igual confirmamos cada pago consultándolo en Bold.",
      },
    ],
    methods: [
      { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express", ...CARD },
      { name: "PSE", detail: "Débito desde cualquier banco", ...PSE },
      { name: "Nequi", detail: "Pago desde la app", ...NEQUI },
      { name: "Daviplata", detail: "Pago desde la app", ...DAVIPLATA },
      { name: "Bancolombia", detail: "Botón de pago", ...BANCOLOMBIA },
    ],
    badges: ["Tarjetas", "PSE", "Nequi", "Daviplata", "Bancolombia"],
    webhook: {
      path: (brandId) => `/api/webhooks/bold/${brandId}`,
      where: "Bold → Integraciones → Webhook → URL de notificaciones.",
    },
    refundHint: "tu panel de Bold (Ventas → la transacción → Anular)",
    checkoutHint: "Al tocar Pagar ahora pasas a Bold para completar tu compra y vuelves a la tienda al terminar.",
    testHint: "Con las llaves de pruebas de Bold los links de pago abren en su ambiente de pruebas y no cobran de verdad.",
  },
};

export const PAYMENT_PROVIDER_IDS: PaymentProviderId[] = ["WOMPI", "MERCADO_PAGO", "PAYU", "EPAYCO", "BOLD"];

/// Las que se ofrecen hoy en Configuración → Pagos: las tres con las que
/// Juan tiene cuenta para probar (pedido del 2026-10-19). PayU y Bold
/// siguen integradas: una tienda que ya cobra con una de ellas la sigue
/// viendo, y a una marca puntual se le da con PAYMENT_PROVIDERS_BY_STORE.
export const OFFERED_PAYMENT_PROVIDER_IDS: PaymentProviderId[] = ["WOMPI", "MERCADO_PAGO", "EPAYCO"];

/// Pasarelas extra para una tienda puntual, por su link ({slug} de
/// {slug}.marcolini.lat) — ej. { "mitienda": ["PAYU"] }.
export const PAYMENT_PROVIDERS_BY_STORE: Record<string, PaymentProviderId[]> = {};

/// Las pasarelas que ve una tienda en Pagos, en el orden de siempre.
export function offeredPaymentProviders(storefrontSlug: string | null, activeProvider: PaymentProviderId | null): PaymentProviderId[] {
  const extra = (storefrontSlug && PAYMENT_PROVIDERS_BY_STORE[storefrontSlug]) || [];
  return PAYMENT_PROVIDER_IDS.filter((id) => OFFERED_PAYMENT_PROVIDER_IDS.includes(id) || extra.includes(id) || id === activeProvider);
}

export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return typeof value === "string" && (PAYMENT_PROVIDER_IDS as string[]).includes(value);
}

/// Nombre para mostrar — null para NONE o un valor que no conocemos.
export function paymentProviderName(id: string | null | undefined): string | null {
  return isPaymentProviderId(id) ? PAYMENT_PROVIDERS[id].name : null;
}

/// "mercado pago" → MERCADO_PAGO. Null si no es una de las integradas.
export function providerForGatewayName(name: string): PaymentProviderId | null {
  const k = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return PAYMENT_PROVIDER_IDS.find((id) => PAYMENT_PROVIDERS[id].name.toLowerCase().replace(/[^a-z0-9]+/g, "") === k) ?? null;
}

/// En qué juego de llaves se busca para un entorno dado.
export function credentialScopeFor(provider: PaymentProviderId, mode: PaymentModeId): CredentialScope {
  return PAYMENT_PROVIDERS[provider].scopes === "SHARED" ? "SHARED" : mode;
}

export function requiredCredentialFields(provider: PaymentProviderId): CredentialField[] {
  return PAYMENT_PROVIDERS[provider].fields.filter((f) => !f.optional);
}

/// true cuando están todos los campos obligatorios de la pasarela.
export function isCredentialSetComplete(
  provider: PaymentProviderId,
  values: Record<string, string | undefined | null> | undefined | null,
): boolean {
  if (!values) return false;
  return requiredCredentialFields(provider).every((f) => Boolean(values[f.key]?.trim()));
}

/// Credenciales públicas del sandbox de PayU para Colombia (están en su
/// documentación: "Test your solution"). Sirven para probar el checkout
/// sin tener cuenta todavía — nunca cobran de verdad.
export const PAYU_SANDBOX_CREDENTIALS = {
  merchantId: "508029",
  accountId: "512321",
  apiKey: "4Vj8eK4rloUd272L48hsrarnUA",
  apiLogin: "pRRXKOl8ikMmt9u",
} as const;
