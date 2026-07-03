import { Resend } from "resend";
import { getOptionalEnv } from "@/lib/env";

function getAppUrl(): string {
  return (
    getOptionalEnv("APP_URL") ??
    getOptionalEnv("NEXTAUTH_URL") ??
    "http://localhost:3000"
  );
}

function getEmailFrom(): string {
  return getOptionalEnv("EMAIL_FROM") ?? "FIDELIZATE <onboarding@resend.dev>";
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = getOptionalEnv("RESEND_API_KEY");

  if (!apiKey) {
    console.log("[FIDELIZATE email — modo consola]");
    console.log(`  Para: ${to}`);
    console.log(`  Asunto: ${subject}`);
    const linkMatch = html.match(/href="([^"]+)"/);
    if (linkMatch?.[1]) {
      console.log(`  Link: ${linkMatch[1]}`);
    }
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

export function buildActionEmailLink(path: string, token: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const link = buildActionEmailLink("/reset-password", token);
  await sendEmail(
    to,
    "Restablece tu contraseña — FIDELIZATE",
    `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
     <p><a href="${link}">Crear nueva contraseña</a></p>
     <p>El enlace expira en 1 hora. Si no lo solicitaste, ignora este correo.</p>`
  );
}

export async function sendEmailVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const link = buildActionEmailLink("/activar", token);
  await sendEmail(
    to,
    "Activa tu cuenta — FIDELIZATE",
    `<p>Te invitaron a FIDELIZATE. Haz clic para verificar tu correo y crear tu contraseña:</p>
     <p><a href="${link}">Activar cuenta</a></p>
     <p>El enlace expira en 24 horas.</p>`
  );
}
