import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimitWithConfig, getClientIp } from "@/lib/rate-limit";
import { issueVerificationToken } from "@/lib/tokens";
import { forgotPasswordSchema } from "@/lib/validators";

const RATE_WINDOW_MS = 15 * 60_000;
const RATE_MAX = 3;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimitWithConfig(`forgot:ip:${ip}`, RATE_MAX, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });

  if (user?.isActive) {
    try {
      const plain = await issueVerificationToken(user.id, "PASSWORD_RESET");
      await sendPasswordResetEmail(user.email, plain);
    } catch {
      // Respuesta genérica para no revelar si el correo existe
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
  });
}
