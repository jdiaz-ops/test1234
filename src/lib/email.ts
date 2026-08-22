import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Marcolini <no-reply@marcolini.co>";

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
