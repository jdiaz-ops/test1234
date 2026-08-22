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
  await resend.emails.send({ from: FROM, to, subject, html });
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
