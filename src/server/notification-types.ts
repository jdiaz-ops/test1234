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
    messageTemplate: "¡Alguien compró con tu código en {marca}! Ganaste {monto} de comisión.",
    placeholders: "marca,monto",
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
    key: "CHALLENGE_REWARD",
    label: "Premio de reto ganado",
    audience: "CREATOR",
    messageTemplate: "¡Ganaste {monto} en un reto! {detalle}",
    placeholders: "monto,detalle",
  },
  {
    key: "CHALLENGE_REWARD_APPROVED",
    label: "Contenido de reto aprobado",
    audience: "CREATOR",
    messageTemplate: 'Tu participación en "{reto}" fue aprobada — {monto} en camino.',
    placeholders: "reto,monto",
  },
  {
    key: "CHALLENGE_CONTENT_REJECTED",
    label: "Contenido de reto rechazado",
    audience: "CREATOR",
    messageTemplate: 'Tu participación en "{reto}" no fue aprobada esta vez. Puedes intentarlo de nuevo si el reto sigue activo.',
    placeholders: "reto",
  },
  {
    key: "CHALLENGE_URGENCY",
    label: "Urgencia de reto por cerrar",
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
      "Te faltan algunos pasos para completar tu perfil de creador — no es obligatorio, pero ayuda a que las marcas confíen más rápido.",
    placeholders: "",
  },
  {
    key: "ONBOARDING_REMINDER_2",
    label: "Recordatorio de onboarding (2da vez)",
    audience: "CREATOR",
    channelEmail: true,
    messageTemplate: 'Todavía te falta terminar tu perfil de creador ({faltantes}) — cuando quieras, está en "Empieza aquí".',
    placeholders: "faltantes",
  },
  {
    key: "PAYOUT_PENDING",
    label: "Pago en camino",
    audience: "CREATOR",
    messageTemplate: "Tienes {monto} en camino — lo transferimos manualmente en los próximos días.",
    placeholders: "monto",
  },
  {
    key: "PAYOUT_PAID",
    label: "Pago realizado",
    audience: "CREATOR",
    messageTemplate: "Te pagamos {monto} — ya deberían verse en tu cuenta.",
    placeholders: "monto",
  },
  {
    key: "INSTANT_PAYOUT_PAID",
    label: "Adelanto de pago procesado",
    audience: "CREATOR",
    messageTemplate: "Pago anticipado procesado: {neto} (se descontó {fee} de fee por adelanto).",
    placeholders: "neto,fee",
  },
  {
    key: "ACCOUNT_SUSPENDED",
    label: "Cuenta suspendida",
    audience: "CREATOR",
    messageTemplate: "Tu cuenta fue suspendida. Contáctanos si crees que es un error.",
    placeholders: "",
  },
  {
    key: "ACCOUNT_REACTIVATED",
    label: "Cuenta reactivada",
    audience: "CREATOR",
    messageTemplate: "Tu cuenta fue reactivada.",
    placeholders: "",
  },
  {
    key: "ENROLLMENT_APPROVED_CREATOR",
    label: "Solicitud de unión aprobada",
    audience: "CREATOR",
    messageTemplate: "{marca} aprobó tu solicitud para unirte a su programa — ya puedes usar tu código.",
    placeholders: "marca",
  },
  {
    key: "ENROLLMENT_REJECTED_CREATOR",
    label: "Solicitud de unión rechazada",
    audience: "CREATOR",
    messageTemplate: "{marca} no aprobó tu solicitud para unirte a su programa esta vez.",
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
    messageTemplate: "Nuevo corte: debes {monto} (comisiones, tarifa y premios de retos). Fecha límite: {fecha}",
    placeholders: "monto,fecha",
  },
  {
    key: "BRAND_PAYMENT_VERIFIED",
    label: "Comprobante verificado",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate: "Verificamos tu pago — tu marca está activa de nuevo.",
    placeholders: "",
  },
  {
    key: "BRAND_PAYMENT_REJECTED",
    label: "Comprobante rechazado",
    audience: "BRAND",
    messageTemplate: "Tu comprobante no se pudo verificar: {razon}. Sube uno nuevo desde Cuenta → Pago.",
    placeholders: "razon",
  },
  {
    key: "BRAND_CHARGE_REMINDER",
    label: "Recordatorio de corte por vencer",
    audience: "BRAND",
    channelEmail: true,
    messageTemplate: "Te quedan {horas} para pagar tu corte de {monto} — vence {fecha}",
    placeholders: "horas,monto,fecha",
  },
  {
    key: "BRAND_LOCKED",
    label: "Marca bloqueada por falta de pago",
    audience: "BRAND",
    messageTemplate:
      "Tu marca quedó oculta del marketplace por falta de pago verificado — sube tu comprobante en Cuenta → Pago para reactivarla.",
    placeholders: "",
  },
  {
    key: "BRAND_APPROVED",
    label: "Marca aprobada",
    audience: "BRAND",
    messageTemplate: "¡Tu marca fue aprobada! Ya apareces activa en el marketplace.",
    placeholders: "",
  },
  {
    key: "BRAND_REJECTED",
    label: "Marca rechazada",
    audience: "BRAND",
    messageTemplate: "Tu marca no fue aprobada esta vez.",
    placeholders: "",
  },
  {
    key: "ENROLLMENT_REQUESTED_BRAND",
    label: "Solicitud de unión de un creador",
    audience: "BRAND",
    messageTemplate: '{creador} solicitó unirse a tu programa "{oferta}" — revísalo en Creadores.',
    placeholders: "creador,oferta",
  },

  // ---------------------------------------------------------------- ADMIN
  {
    key: "SALE_ADMIN",
    label: "Venta generada (aviso a admin)",
    audience: "ADMIN",
    messageTemplate: "{creador} generó una venta para {marca} — ganaste {monto} de comisión.",
    placeholders: "creador,marca,monto",
  },
  {
    key: "REFERRAL_ADMIN",
    label: "Bono de referido por pagar",
    audience: "ADMIN",
    messageTemplate: "Bono de referido por pagar: {referidor} invitó a {referido} — {monto}.",
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
    messageTemplate: "{marca} subió un comprobante de pago por {monto} — revísalo en Facturas.",
    placeholders: "marca,monto",
  },
  {
    key: "STORE_CONNECTION_ERROR_ADMIN",
    label: "Falla al conectar la tienda de una marca",
    audience: "ADMIN",
    messageTemplate: "No se pudo crear el código de descuento en la tienda de {marca} — la conexión falló. Revísalo en Marcas → Tienda.",
    placeholders: "marca",
  },
  {
    key: "FRAUD_FLAG_ADMIN",
    label: "Alerta de fraude",
    audience: "ADMIN",
    messageTemplate: "Posible fraude: {razon}. Revísalo en Antifraude.",
    placeholders: "razon",
  },
];
