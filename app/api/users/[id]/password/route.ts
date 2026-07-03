import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { BCRYPT_ROUNDS, generateTemporaryPassword } from "@/lib/password";
import { checkRateLimitWithConfig, getClientIp } from "@/lib/rate-limit";
import { adminResetPasswordSchema } from "@/lib/validators";

type Params = { params: { id: string } };

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

export async function POST(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const ip = getClientIp(request);
  const limitIp = checkRateLimitWithConfig(`admin-pwd:ip:${ip}`, RATE_MAX, RATE_WINDOW_MS);
  if (!limitIp.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta en un minuto." }, { status: 429 });
  }
  const limitUser = checkRateLimitWithConfig(
    `admin-pwd:user:${session.userId}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!limitUser.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta en un minuto." }, { status: 429 });
  }

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const target = await db.user.findFirst({
    where: { id: params.id, businessId: access.businessId },
    select: { id: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = adminResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const plainPassword = parsed.data.password ?? generateTemporaryPassword();
  const passwordHash = await hash(plainPassword, BCRYPT_ROUNDS);

  await db.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  const response: { ok: true; temporaryPassword?: string } = { ok: true };
  if (!parsed.data.password) {
    response.temporaryPassword = plainPassword;
  }

  return NextResponse.json(response);
}
