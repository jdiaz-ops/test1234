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
     marca se oculta del marketplace hasta que regularices la situación.</p>
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
     pago antes de esa fecha, tu marca se oculta del marketplace hasta que regularices la situación.</p>`
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
