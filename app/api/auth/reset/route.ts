import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { BCRYPT_ROUNDS } from "@/lib/password";
import { checkRateLimitWithConfig, getClientIp } from "@/lib/rate-limit";
import { validateVerificationToken } from "@/lib/tokens";
import { resetPasswordSchema } from "@/lib/validators";

const RATE_WINDOW_MS = 15 * 60_000;
const RATE_MAX = 5;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimitWithConfig(`reset:ip:${ip}`, RATE_MAX, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const token = await validateVerificationToken(parsed.data.token, "PASSWORD_RESET");
  if (!token) {
    return NextResponse.json({ error: "Enlace inválido o expirado" }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.newPassword, BCRYPT_ROUNDS);

  await db.$transaction([
    db.user.update({
      where: { id: token.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    }),
    db.verificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
