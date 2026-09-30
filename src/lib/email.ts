import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Mientras no haya un dominio propio verificado en Resend, se manda desde su
// dirección de prueba (onboarding@resend.dev) — funciona sin configurar nada,
// pero Resend solo entrega a la cuenta de correo con la que te registraste
// ahí. Apenas verifiques tu dominio, pon EMAIL_FROM en Vercel (ej. "Marcolini
// <no-reply@marcolini.co>") y desde ahí sí llega a cualquier destinatario.
const FROM = process.env.EMAIL_FROM || "Marcolini <onboarding@resend.dev>";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // Sin API key configurada (típico en desarrollo local): en vez de fallar,
    // dejamos el correo visible en consola para poder probar el flujo.
    console.log(`\n📧  [email simulado] Para: ${to}\nAsunto: ${subject}\n${html}\n`);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // Un correo que no sale (dominio sin verificar, límite de Resend en modo
    // de prueba, lo que sea) nunca debe tumbar la acción que lo disparó —
    // registrarse, restablecer contraseña, etc. Se deja registrado el error
    // para poder diagnosticarlo en los logs, pero el flujo sigue.
    console.error(`[email] no se pudo enviar a ${to} ("${subject}"):`, err);
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await send(
    to,
    "Confirma tu correo en Marcolini",
    `<p>Gracias por registrarte en Marcolini.</p>
     <p><a href="${verifyUrl}">Haz clic aquí para confirmar tu correo</a></p>
     <p>Este link expira en 24 horas.</p>`
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await send(
    to,
    "Recupera tu contraseña en Marcolini",
    `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
     <p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p>
     <p>Si no fuiste tú, ignora este correo. Este link expira en 1 hora.</p>`
  );
}

/// Invitación a una cuenta que el admin creó a mano (marca o creador
/// agregados manualmente) — reusa el mismo link de "restablecer
/// contraseña" como forma de que la persona ponga su propia clave.
export async function sendAccountInviteEmail(to: string, setPasswordUrl: string) {
  await send(
    to,
    "Te dieron acceso a Marcolini",
    `<p>Ya tienes una cuenta activa en Marcolini.</p>
     <p><a href="${setPasswordUrl}">Haz clic aquí para poner tu contraseña</a> y entrar.</p>
     <p>Este link expira en 1 hora — si expira, puedes pedir uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.</p>`
  );
}

/// Aviso de cobro del día 1 — se manda en paralelo a lo que ya se ve en el
/// dashboard, por si la marca no entra a la plataforma. Trae el mismo PDF
/// que se muestra ahí, con el desglose, las instrucciones de pago y la
/// fecha límite antes del bloqueo.
export async function sendBrandChargeEmail(
  to: string,
  params: { companyName: string; totalAmount: string; dueAt: string; paymentInstructions: string | null }
) {
  await send(
    to,
    `Marcolini — tu cobro de este mes: ${params.totalAmount}`,
    `<p>Hola ${params.companyName},</p>
     <p>Este mes te corresponde pagar <strong>${params.totalAmount}</strong> (comisión de tus creadores de
     contenido + tarifa de Marcolini).</p>
     <p><strong>Fecha límite: ${params.dueAt}</strong> Si no verificamos tu pago antes de esa fecha, tu
     cuenta queda temporalmente inhabilitada (sin acceso al panel) hasta que regularices — el servicio,
     marketplace y códigos de tus creadores siguen funcionando.</p>
     ${params.paymentInstructions ? `<p>${params.paymentInstructions.replace(/\n/g, "<br/>")}</p>` : ""}
     <p>Entra a tu portal de Marcolini, en Cuenta → Pago, para ver el desglose completo y subir tu
     comprobante una vez pagues.</p>`
  );
}

/// Recordatorio antes de que se cumpla el plazo del corte (48h y 24h
/// antes) — para que a nadie se le bloquee la marca solo por no haberse
/// dado cuenta a tiempo.
export async function sendBrandChargeReminderEmail(
  to: string,
  params: { companyName: string; totalAmount: string; dueAt: string; hoursLabel: string }
) {
  await send(
    to,
    `Marcolini — te quedan ${params.hoursLabel} para pagar tu corte`,
    `<p>Hola ${params.companyName},</p>
     <p>Recordatorio: tienes un corte pendiente de <strong>${params.totalAmount}</strong> — el plazo vence
     el <strong>${params.dueAt}</strong>.</p>
     <p>Si ya pagaste, sube tu comprobante en Cuenta → Pago para que lo verifiquemos. Si no verificamos tu
     pago antes de esa fecha, tu cuenta queda temporalmente inhabilitada (sin acceso al panel) hasta que
     regularices — el servicio, marketplace y códigos de tus creadores siguen funcionando.</p>`
  );
}

/// Se manda apenas se verifica el comprobante — la marca queda
/// reactivada de inmediato en la plataforma.
export async function sendBrandPaymentVerifiedEmail(to: string, companyName: string) {
  await send(
    to,
    "Marcolini — pago verificado, tu marca está activa",
    `<p>Hola ${companyName},</p>
     <p>Verificamos tu comprobante de pago — tu marca ya está activa y visible en el marketplace de nuevo.</p>`
  );
}

/// Se manda cuando la marca confirma una reserva de servicio (clase
/// presencial o virtual) desde Pedidos — el comprador no tiene cuenta en
/// Marcolini, así que este correo es la única forma de avisarle.
export async function sendServiceBookingConfirmedEmail(
  to: string,
  params: { companyName: string; serviceName: string; confirmedAt: string; meetingInfo: string | null }
) {
  await send(
    to,
    `${params.companyName} confirmó tu reserva — ${params.serviceName}`,
    `<p>¡Buenas noticias! ${params.companyName} confirmó tu reserva de "${params.serviceName}".</p>
     <p><strong>Fecha y hora: ${params.confirmedAt}</strong></p>
     ${params.meetingInfo ? `<p>${params.meetingInfo.replace(/\n/g, "<br/>")}</p>` : ""}`
  );
}

/// Se manda cada vez que evaluateCreatorBadges (creator-badge-service.ts)
/// le otorga una insignia nueva a un creador — el cron diario es el único
/// lugar que la dispara.
export async function sendBadgeEarnedEmail(
  to: string,
  params: { displayName: string; label: string; description: string }
) {
  await send(
    to,
    `Marcolini — nueva insignia: ${params.label}`,
    `<p>Hola ${params.displayName},</p>
     <p>¡Desbloqueaste una insignia nueva! <strong>${params.label}</strong> — ${params.description}</p>
     <p>Ya la puedes ver en tu Dashboard.</p>`
  );
}

/// Se manda desde sendChallengeUrgencyReminders (challenge-service.ts) — 3
/// días y 1 día antes de que cierre un reto en el que el creador puede
/// participar y todavía no completó.
export async function sendChallengeUrgencyEmail(
  to: string,
  params: { displayName: string; challengeName: string; daysLabel: string; progressText: string }
) {
  await send(
    to,
    `Marcolini — quedan ${params.daysLabel} para "${params.challengeName}"`,
    `<p>Hola ${params.displayName},</p>
     <p>La campaña <strong>${params.challengeName}</strong> cierra en ${params.daysLabel}.${params.progressText}</p>
     <p>Revísala en Campañas antes de que se acabe el tiempo.</p>`
  );
}

/// Se manda desde sendOnboardingReminders (creator-onboarding-service.ts) —
/// a los 3 y 7 días de registrarse un creador, si todavía no completó su
/// perfil. No bloqueante — es solo un empujón.
export async function sendOnboardingReminderEmail(
  to: string,
  params: { displayName: string; missingLabels: string[]; round: 1 | 2 }
) {
  const subject =
    params.round === 1
      ? "Marcolini — te faltan unos pasos en tu perfil"
      : "Marcolini — tu perfil de creador sigue incompleto";
  await send(
    to,
    subject,
    `<p>Hola ${params.displayName},</p>
     <p>Todavía te falta: <strong>${params.missingLabels.join(", ")}</strong>.</p>
     <p>No es obligatorio — ya puedes usar toda la plataforma — pero completarlo ayuda a que las marcas confíen
     más rápido y a que te paguemos sin contratiempos. Lo encuentras en "Empieza aquí" dentro de tu cuenta.</p>`
  );
}

/// Correo genérico para los tipos de notificación (ver notification-service.ts
/// + Admin → Notificaciones → Configuración) que tienen el canal "Correo"
/// activado pero no tienen una plantilla de correo con diseño propio — usa
/// el mismo texto que ya se ve en la notificación dentro de la app.
export async function sendGenericNotificationEmail(to: string, message: string) {
  await send(to, "Marcolini", `<p>${message}</p>`);
}

/// Comunicado del admin a todas las marcas o a todos los creadores — el
/// cuerpo ya viene armado (texto simple, se envuelve en párrafos).
export async function sendBroadcastEmail(to: string, subject: string, body: string) {
  const paragraphs = body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${line}</p>`)
    .join("\n");
  await send(to, subject, paragraphs);
}

// ----------------------------------------------------------------------------
// Pedidos de "Mi tienda" — confirmación al comprador, aviso de venta a la
// marca, envío con guía y devolución. Ver conversación del 2026-09-30 ("la
// marca tiene que recibir correo también").
// ----------------------------------------------------------------------------

/// Todo lo que escribe el comprador (nombre, dirección, notas) pasa por acá
/// antes de entrar al HTML del correo.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCOPCents(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export type OrderEmailData = {
  orderNumber: string;
  brandName: string;
  brandLogoUrl: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  items: { name: string; variantLabel: string | null; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingNotes: string | null;
};

function emailLayout(brandName: string, logoUrl: string | null, inner: string) {
  const header = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" style="max-height:56px;max-width:200px">`
    : `<strong style="font-size:18px">${escapeHtml(brandName)}</strong>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px;margin:0 auto">
  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #eee">${header}</div>
  <div style="padding:24px 0;font-size:14px;line-height:1.5">${inner}</div>
</div>`;
}

function itemsTable(data: OrderEmailData) {
  const rows = data.items
    .map(
      (i) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(i.name)}${
        i.variantLabel ? `<br><span style="color:#666;font-size:12px">${escapeHtml(i.variantLabel)}</span>` : ""
      }</td>
  <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
  <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${formatCOPCents(i.unitPriceCents * i.quantity)}</td>
</tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:4px 0;${bold ? "font-weight:bold" : "color:#555"}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:bold" : ""}">${value}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><th style="text-align:left;padding-bottom:6px">Producto</th><th style="padding-bottom:6px">Cant.</th><th style="text-align:right;padding-bottom:6px">Valor</th></tr>
${rows}
${line("Subtotal", formatCOPCents(data.subtotalCents))}
${data.discountCents > 0 ? line(`Descuento${data.discountCode ? ` (${escapeHtml(data.discountCode)})` : ""}`, `-${formatCOPCents(data.discountCents)}`) : ""}
${line("Envío", data.shippingCents > 0 ? formatCOPCents(data.shippingCents) : "Gratis")}
${line("Total", formatCOPCents(data.totalCents), true)}
${data.taxCents > 0 ? line("Incluye IVA", formatCOPCents(data.taxCents)) : ""}
</table>`;
}

function addressBlock(data: OrderEmailData) {
  if (!data.shippingAddress) return "";
  const place = [data.shippingCity, data.shippingRegion].filter(Boolean).map((v) => escapeHtml(v!)).join(", ");
  return `<p style="margin-top:20px"><strong>Dirección de envío</strong><br>${escapeHtml(data.buyerName)}<br>${escapeHtml(
    data.shippingAddress,
  )}<br>${place}${data.shippingNotes ? `<br><span style="color:#666">${escapeHtml(data.shippingNotes)}</span>` : ""}</p>`;
}

function button(href: string, label: string) {
  return `<p style="text-align:center;margin:28px 0"><a href="${escapeHtml(
    href,
  )}" style="background:#111;color:#fff;text-decoration:none;padding:12px 24px;font-weight:bold;display:inline-block">${label}</a></p>`;
}

/// Al comprador, apenas Wompi aprueba el pago.
export async function sendOrderConfirmationEmail(data: OrderEmailData, orderUrl: string | null) {
  const firstName = data.buyerName.trim().split(/\s+/)[0] ?? "";
  await send(
    data.buyerEmail,
    `Tu pedido #${data.orderNumber} en ${data.brandName} está confirmado`,
    emailLayout(
      data.brandName,
      data.brandLogoUrl,
      `<p>Hola ${escapeHtml(firstName)},</p>
<p>Recibimos tu pago. Tu pedido <strong>#${data.orderNumber}</strong> ya está confirmado y ${escapeHtml(
        data.brandName,
      )} lo está preparando. Te avisamos por este medio cuando salga.</p>
${itemsTable(data)}
${addressBlock(data)}
${orderUrl ? button(orderUrl, "Ver mi pedido") : ""}`,
    ),
  );
}

/// A la marca: "tienes una venta".
export async function sendNewOrderBrandEmail(to: string, data: OrderEmailData, portalOrderUrl: string) {
  await send(
    to,
    `Nueva venta: pedido #${data.orderNumber} por ${formatCOPCents(data.totalCents)}`,
    emailLayout(
      data.brandName,
      data.brandLogoUrl,
      `<p><strong>¡Tienes una venta nueva!</strong></p>
<p>${escapeHtml(data.buyerName)} pagó el pedido <strong>#${data.orderNumber}</strong>.<br>
<span style="color:#555">${escapeHtml(data.buyerEmail)} · ${escapeHtml(data.buyerPhone)}</span></p>
${data.discountCode ? `<p>Usó el código de creador <strong>${escapeHtml(data.discountCode)}</strong>.</p>` : ""}
${itemsTable(data)}
${addressBlock(data)}
${button(portalOrderUrl, "Ver el pedido")}
<p style="color:#666;font-size:12px">El inventario de estos productos ya se descontó.</p>`,
    ),
  );
}

/// Al comprador, cuando la marca marca el pedido como enviado.
export async function sendOrderShippedEmail(
  data: Pick<OrderEmailData, "orderNumber" | "brandName" | "brandLogoUrl" | "buyerName" | "buyerEmail">,
  shipment: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null },
  orderUrl: string | null,
) {
  const firstName = data.buyerName.trim().split(/\s+/)[0] ?? "";
  await send(
    data.buyerEmail,
    `Tu pedido #${data.orderNumber} de ${data.brandName} va en camino`,
    emailLayout(
      data.brandName,
      data.brandLogoUrl,
      `<p>Hola ${escapeHtml(firstName)},</p>
<p>Tu pedido <strong>#${data.orderNumber}</strong> ya salió.</p>
${
  shipment.carrier || shipment.trackingNumber
    ? `<p>${shipment.carrier ? `Transportadora: <strong>${escapeHtml(shipment.carrier)}</strong><br>` : ""}${
        shipment.trackingNumber ? `Número de guía: <strong>${escapeHtml(shipment.trackingNumber)}</strong>` : ""
      }</p>`
    : ""
}
${shipment.trackingUrl ? button(shipment.trackingUrl, "Rastrear mi envío") : ""}
${orderUrl ? `<p><a href="${escapeHtml(orderUrl)}">Ver mi pedido</a></p>` : ""}`,
    ),
  );
}

/// Al comprador, cuando la marca registra una devolución.
export async function sendOrderRefundedEmail(
  data: Pick<OrderEmailData, "orderNumber" | "brandName" | "brandLogoUrl" | "buyerName" | "buyerEmail" | "totalCents">,
  reason: string | null,
) {
  const firstName = data.buyerName.trim().split(/\s+/)[0] ?? "";
  await send(
    data.buyerEmail,
    `Devolución de tu pedido #${data.orderNumber} en ${data.brandName}`,
    emailLayout(
      data.brandName,
      data.brandLogoUrl,
      `<p>Hola ${escapeHtml(firstName)},</p>
<p>${escapeHtml(data.brandName)} registró la devolución de tu pedido <strong>#${data.orderNumber}</strong> por ${formatCOPCents(
        data.totalCents,
      )}.</p>
${reason ? `<p style="color:#555">Motivo: ${escapeHtml(reason)}</p>` : ""}
<p>El dinero vuelve por el mismo medio con el que pagaste. Según tu banco puede tardar algunos días hábiles en verse.</p>`,
    ),
  );
}

/// A la marca: llegó una reseña nueva para revisar.
export async function sendNewReviewBrandEmail(
  to: string,
  params: { productName: string; authorName: string; rating: number; body: string; reviewsUrl: string },
) {
  await send(
    to,
    `Nueva reseña de ${params.rating} ${params.rating === 1 ? "estrella" : "estrellas"} para ${params.productName}`,
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px;margin:0 auto;font-size:14px;line-height:1.5">
<p><strong>${escapeHtml(params.authorName)}</strong> dejó una reseña de ${"★".repeat(params.rating)}${"☆".repeat(5 - params.rating)} para <strong>${escapeHtml(params.productName)}</strong>:</p>
<blockquote style="border-left:3px solid #ddd;margin:0;padding:4px 12px;color:#444">${escapeHtml(params.body)}</blockquote>
<p>No se publica hasta que la apruebes.</p>
<p><a href="${escapeHtml(params.reviewsUrl)}">Revisar reseñas</a></p>
</div>`,
  );
}
