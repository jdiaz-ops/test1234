/// Catálogo por defecto de todos los tipos de notificación de la
/// plataforma — se siembra una sola vez (ver seedPlatform en bootstrap.ts,
/// con upsert que nunca pisa lo que el admin ya haya editado) y de ahí en
/// adelante vive editable en Admin → Notificaciones → Configuración.
///
/// `channelEmail: true` de fábrica solo en los tipos que ya tenían una
/// plantilla de correo con diseño propio (ver lib/email.ts) — los demás
/// arrancan con el correo apagado, pero el admin lo puede prender cuando
/// quiera (ahí sale con el mismo texto de la notificación, sin diseño
/// especial, ver sendGenericNotificationEmail).
export const NOTIFICATION_TYPE_DEFAULTS: Array<{
  key: string;
  label: string;
  audience: "CREATOR" | "BRAND" | "ADMIN";
  channelEmail?: boolean;
  messageTemplate: string;
  placeholders: string;
}> = [
  // -------------------------------------------------------------- CREADOR
  {
    key: "SALE_COMMISSION",
    label: "Venta con su código",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "¡Vendiste con tu código en {marca}! Ganaste {monto} de comisión. Se te paga el {fecha_pago}, junto con tus demás ventas de {mes}.",
    placeholders: "marca,monto,fecha_pago,mes",
  },
  {
    key: "REFERRAL_QUALIFIED",
    label: "Bono de referido calificado",
    audience: "CREATOR",
    messageTemplate:
      "¡{referido} hizo su primera venta! Ganaste {monto} por invitarlo — te lo transferimos junto a tu próximo pago.",
    placeholders: "referido,monto",
  },
  {
    key: "PRODUCT_SENT",
    label: "Producto enviado por la marca",
    audience: "CREATOR",
    messageTemplate: '{marca} te envió tu producto: "{descripcion}"{guia}',
    placeholders: "marca,descripcion,guia",
  },
  {
    key: "SAMPLE_APPROVED",
    label: "Muestra aprobada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      '{marca} aprobó tu muestra de "{producto}" y pronto te la envía.',
    placeholders: "marca,producto",
  },
  {
    key: "SAMPLE_REJECTED",
    label: "Muestra rechazada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      '{marca} no puede enviarte la muestra de "{producto}" esta vez.{razon}',
    placeholders: "marca,producto,razon",
  },
  {
    key: "SAMPLE_OFFERED",
    label: "Una marca te ofreció una muestra",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      '{marca} te quiere regalar "{producto}". Acéptala en Solicitar muestras y déjale tu dirección de envío.',
    placeholders: "marca,producto",
  },
  {
    key: "ENROLLMENT_INVITED_CREATOR",
    label: "Una marca te invitó a unirte",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "{marca} te invitó a su programa de creadores. Revisa la invitación en Marketplace de marcas.",
    placeholders: "marca",
  },
  {
    key: "CONTENT_LICENSE_RENTED",
    label: "Una marca alquiló uno de tus contenidos",
    audience: "CREATOR",
    messageTemplate:
      "{marca} alquiló tu contenido por {dias} días — te pagan {monto} en tu próximo pago.",
    placeholders: "marca,dias,monto",
  },
  {
    key: "PAID_CONTENT_REQUESTED",
    label: "Una marca te encargó contenido pagado",
    audience: "CREATOR",
    messageTemplate:
      "{marca} te quiere encargar contenido por {monto} — revísalo en Contenido pagado.",
    placeholders: "marca,monto",
  },
  {
    key: "NEW_MESSAGE_CREATOR",
    label: "Mensaje nuevo de una marca",
    audience: "CREATOR",
    messageTemplate: '{marca} te escribió: "{mensaje}"',
    placeholders: "marca,mensaje",
  },
  {
    key: "BADGE_EARNED",
    label: "Insignia ganada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate: "¡Nueva insignia! {insignia} — {descripcion}",
    placeholders: "insignia,descripcion",
  },
  {
    key: "CAMPAIGN_STARTED",
    label: "Nueva campaña activa",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      '¡Nueva campaña en {marca}: "{campana}"! {detalle} Termina el {fecha} — buen momento para avisarle a tu audiencia.',
    placeholders: "marca,campana,detalle,fecha",
  },
  {
    key: "CHALLENGE_REWARD",
    label: "Premio de campaña ganado",
    audience: "CREATOR",
    messageTemplate: "¡Ganaste {monto} en una campaña! {detalle}",
    placeholders: "monto,detalle",
  },
  {
    key: "CHALLENGE_REWARD_APPROVED",
    label: "Contenido de campaña aprobado",
    audience: "CREATOR",
    messageTemplate:
      'Tu participación en "{reto}" fue aprobada — {monto} en camino.',
    placeholders: "reto,monto",
  },
  {
    key: "CHALLENGE_CONTENT_REJECTED",
    label: "Contenido de campaña rechazado",
    audience: "CREATOR",
    messageTemplate:
      'Tu participación en "{reto}" no fue aprobada esta vez. Puedes intentarlo de nuevo si la campaña sigue activa.',
    placeholders: "reto",
  },
  {
    key: "CHALLENGE_URGENCY",
    label: "Urgencia de campaña por cerrar",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate: 'Quedan {dias} para "{reto}".{progreso}',
    placeholders: "dias,reto,progreso",
  },
  {
    key: "ONBOARDING_REMINDER_1",
    label: "Recordatorio de onboarding (1ra vez)",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      'Te faltan unos pasos para completar tu perfil. Termínalo en "Empieza aquí" y las marcas te aprobarán más rápido.',
    placeholders: "",
  },
  {
    key: "ONBOARDING_REMINDER_2",
    label: "Recordatorio de onboarding (2da vez)",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      'Aún te falta: {faltantes}. Lo terminas en un par de minutos desde "Empieza aquí".',
    placeholders: "faltantes",
  },
  {
    key: "PAYOUT_PENDING",
    label: "Pago en camino",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "Tienes {monto} en camino. Te lo transferimos en los próximos días.",
    placeholders: "monto",
  },
  {
    key: "PAYOUT_PAID",
    label: "Pago realizado",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "Te transferimos {monto}. Ya debería verse en tu cuenta.",
    placeholders: "monto",
  },
  {
    key: "INSTANT_PAYOUT_PAID",
    label: "Adelanto de pago procesado",
    audience: "CREATOR",
    messageTemplate:
      "Pago anticipado procesado: {neto} (se descontó {fee} de fee por adelanto).",
    placeholders: "neto,fee",
  },
  {
    key: "ACCOUNT_SUSPENDED",
    label: "Cuenta suspendida",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "Suspendimos tu cuenta. Si crees que es un error, escríbenos y lo revisamos.",
    placeholders: "",
  },
  {
    key: "ACCOUNT_REACTIVATED",
    label: "Cuenta reactivada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "¡Tu cuenta está activa de nuevo! Ya puedes usar Marcolini con normalidad.",
    placeholders: "",
  },
  {
    key: "ENROLLMENT_APPROVED_CREATOR",
    label: "Solicitud de unión aprobada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "¡Ya eres parte de {marca}! Tu código está listo en Mis Códigos y Links.",
    placeholders: "marca",
  },
  {
    key: "ENROLLMENT_REJECTED_CREATOR",
    label: "Solicitud de unión rechazada",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "{marca} no aprobó tu solicitud esta vez. Hay más marcas esperándote en el Marketplace.",
    placeholders: "marca",
  },
  {
    key: "BRAND_PAUSED_CREATOR",
    label: "Marca temporalmente no disponible (Nivel 3)",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "{marca} está en pausa por ahora y tu código no está generando ventas. Te avisamos apenas vuelva.",
    placeholders: "marca",
  },
  {
    key: "BRAND_RESUMED_CREATOR",
    label: "Marca disponible de nuevo",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate:
      "¡{marca} volvió! Tu código funciona de nuevo; buen momento para compartirlo.",
    placeholders: "marca",
  },

  // ---------------------------------------------------------------- MARCA
  {
    key: "PRODUCT_REQUESTED",
    label: "Creador pidió producto",
    audience: "BRAND",
    messageTemplate: '{creador} pidió un producto: "{descripcion}"',
    placeholders: "creador,descripcion",
  },
  {
    key: "SAMPLE_REQUESTED",
    label: "Creador solicitó una muestra",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      '{creador} quiere probar "{producto}". Aprueba o rechaza la muestra en Muestras.',
    placeholders: "creador,producto",
  },
  {
    key: "SAMPLE_OFFER_ACCEPTED",
    label: "Creador aceptó tu oferta de muestra",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      '{creador} aceptó tu muestra de "{producto}". Ya está en Pedidos, lista para despachar.',
    placeholders: "creador,producto",
  },
  {
    key: "PAID_CONTENT_REQUEST_ACCEPTED",
    label: "Creador aceptó tu encargo de contenido",
    audience: "BRAND",
    messageTemplate:
      "{creador} aceptó tu encargo de contenido por {monto}.",
    placeholders: "creador,monto",
  },
  {
    key: "PAID_CONTENT_REQUEST_DECLINED",
    label: "Creador rechazó tu encargo de contenido",
    audience: "BRAND",
    messageTemplate: "{creador} no aceptó tu encargo de contenido.",
    placeholders: "creador",
  },
  {
    key: "PAID_CONTENT_DELIVERED",
    label: "Creador entregó el contenido encargado",
    audience: "BRAND",
    messageTemplate:
      "{creador} entregó el contenido que le encargaste — revísalo en Contenido pagado.",
    placeholders: "creador",
  },
  {
    key: "ENROLLMENT_INVITATION_DECLINED",
    label: "Creador rechazó tu invitación",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "{creador} no aceptó tu invitación esta vez.",
    placeholders: "creador",
  },
  {
    key: "NEW_MESSAGE_BRAND",
    label: "Mensaje nuevo de un creador",
    audience: "BRAND",
    messageTemplate: '{creador} te escribió: "{mensaje}"',
    placeholders: "creador,mensaje",
  },
  {
    key: "BRAND_CHARGE",
    label: "Nuevo corte a pagar",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Tu corte está listo: {monto} en comisiones y tarifas. Fecha límite: {fecha}.",
    placeholders: "monto,fecha",
  },
  {
    key: "BRAND_PAYMENT_VERIFIED",
    label: "Comprobante verificado",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Verificamos tu pago. ¡Gracias! Todo está al día.",
    placeholders: "",
  },
  {
    key: "BRAND_PAYMENT_REJECTED",
    label: "Comprobante rechazado",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "No pudimos verificar tu comprobante: {razon}. Sube uno nuevo en Configuración → Plan y facturación.",
    placeholders: "razon",
  },
  {
    key: "BRAND_CHARGE_REMINDER",
    label: "Recordatorio de corte por vencer",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Te quedan {horas} para pagar tu corte de {monto}. Vence {fecha}.",
    placeholders: "horas,monto,fecha",
  },
  {
    key: "BRAND_LOCKED",
    label: "Cuenta inhabilitada por falta de pago (Nivel 2)",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Tu acceso al panel está en pausa porque no hemos recibido tu pago. Tu tienda y los códigos de tus creadores siguen funcionando. Entra a Marcolini y sube tu comprobante antes del {fecha} para que el servicio no se desactive.",
    placeholders: "fecha",
  },
  {
    key: "BRAND_DEACTIVATION_REMINDER",
    label: "Recordatorio antes de desactivar el servicio (Nivel 2 → 3)",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Última alerta: si no pagas antes del {fecha}, tu servicio se desactiva. Saldrás del marketplace y los códigos de tus creadores dejarán de funcionar.",
    placeholders: "fecha",
  },
  {
    key: "BRAND_DEACTIVATED",
    label: "Servicio desactivado por falta de pago (Nivel 3)",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Tu servicio está desactivado por falta de pago: no apareces en el marketplace y los códigos de tus creadores no registran ventas. Debes {monto}. Sube tu comprobante y lo reactivamos apenas lo verifiquemos.",
    placeholders: "monto",
  },
  {
    key: "BRAND_APPROVED",
    label: "Marca aprobada",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "¡Tu marca fue aprobada! Ya apareces en el marketplace y los creadores pueden unirse a tu programa.",
    placeholders: "",
  },
  {
    key: "BRAND_REJECTED",
    label: "Marca rechazada",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      "Tu marca no fue aprobada esta vez. Escríbenos si quieres saber por qué.",
    placeholders: "",
  },
  {
    key: "ENROLLMENT_REQUESTED_BRAND",
    label: "Solicitud de unión de un creador",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate:
      '{creador} quiere unirse a tu programa "{oferta}". Apruébalo en Creadores.',
    placeholders: "creador,oferta",
  },

  // ---------------------------------------------------------------- ADMIN
  {
    key: "SALE_ADMIN",
    label: "Venta generada (aviso a admin)",
    audience: "ADMIN",
    messageTemplate:
      "{creador} generó una venta para {marca} — ganaste {monto} de comisión.",
    placeholders: "creador,marca,monto",
  },
  {
    key: "REFERRAL_ADMIN",
    label: "Bono de referido por pagar",
    audience: "ADMIN",
    messageTemplate:
      "Bono de referido por pagar: {referidor} invitó a {referido} — {monto}.",
    placeholders: "referidor,referido,monto",
  },
  {
    key: "BRAND_PENDING_ADMIN",
    label: "Marca nueva pendiente de revisar",
    audience: "ADMIN",
    messageTemplate: "Nueva marca pendiente de revisión: {marca}.",
    placeholders: "marca",
  },
  {
    key: "BRAND_PROOF_SUBMITTED_ADMIN",
    label: "Comprobante de pago subido por una marca",
    audience: "ADMIN",
    messageTemplate:
      "{marca} subió un comprobante de pago por {monto} — revísalo en Facturas.",
    placeholders: "marca,monto",
  },
  {
    key: "BRAND_DEACTIVATED_ADMIN",
    label: "Marca con servicio desactivado (Nivel 3)",
    audience: "ADMIN",
    messageTemplate:
      "{marca} llegó al Nivel 3: servicio desactivado por falta de pago. Debe {monto}.",
    placeholders: "marca,monto",
  },
  {
    key: "STORE_CONNECTION_ERROR_ADMIN",
    label: "Falla al conectar la tienda de una marca",
    audience: "ADMIN",
    messageTemplate:
      "No se pudo crear el código de descuento en la tienda de {marca} — la conexión falló. Revísalo en Marcas → Tienda.",
    placeholders: "marca",
  },
  {
    key: "DISCOUNT_CODE_TOGGLE_FAILED_ADMIN",
    label: "Falla al apagar/prender un código por Nivel 3",
    audience: "ADMIN",
    messageTemplate:
      "No se pudo {accion} el código {codigo} de {creador} en la tienda de {marca} — revísalo manualmente en la tienda.",
    placeholders: "accion,codigo,creador,marca",
  },
  {
    key: "DISCOUNT_BOOST_FAILED_ADMIN",
    label: "Falla al subir/bajar un descuento por campaña",
    audience: "ADMIN",
    messageTemplate:
      'No se pudo {accion} el % de descuento del código {codigo} de {creador} en la tienda de {marca} (campaña "{campana}") — revísalo manualmente en la tienda.',
    placeholders: "accion,codigo,creador,marca,campana",
  },
  {
    key: "FRAUD_FLAG_ADMIN",
    label: "Alerta de fraude",
    audience: "ADMIN",
    messageTemplate: "Posible fraude: {razon}. Revísalo en Antifraude.",
    placeholders: "razon",
  },
  {
    key: "GDPR_DATA_REQUEST_ADMIN",
    label: "Solicitud de datos de un comprador (Shopify)",
    audience: "ADMIN",
    channelEmail: true,
    messageTemplate:
      "Un comprador de {marca} pidió sus datos vía Shopify ({correo}). Encontramos {cantidad} venta(s) con ese correo — tienes 30 días para responderle a la tienda a mano.",
    placeholders: "marca,correo,cantidad",
  },
];
