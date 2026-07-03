import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { checkRateLimitWithConfig, getClientIp } from "@/lib/rate-limit";
import { sendUserInviteEmail } from "@/lib/user-invite";

type Params = { params: { id: string } };

const RATE_WINDOW_MS = 15 * 60_000;
const RATE_MAX = 3;

export async function POST(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const ip = getClientIp(request);
  const limitIp = checkRateLimitWithConfig(`resend-invite:ip:${ip}`, RATE_MAX, RATE_WINDOW_MS);
  if (!limitIp.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 });
  }

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const target = await db.user.findFirst({
    where: { id: params.id, businessId: access.businessId },
    select: { id: true, email: true, emailVerified: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  if (target.emailVerified) {
    return NextResponse.json({ error: "Este usuario ya activó su cuenta" }, { status: 400 });
  }

  try {
    await sendUserInviteEmail(target.id, target.email);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: `No se pudo enviar la invitación. ${detail}`.trim() },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
