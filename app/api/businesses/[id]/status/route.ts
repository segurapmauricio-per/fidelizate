import { NextResponse } from "next/server";
import { requireSession, isSessionUser, requireSuperAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { statusPatchSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const parsed = statusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const existing = await db.business.findUnique({ where: { id: params.id } });
  if (!existing || existing.slug === "platform") {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const business = await db.business.update({
    where: { id: params.id },
    data: {
      isActive: parsed.data.isActive,
      deactivatedAt: parsed.data.isActive ? null : new Date(),
    },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ business });
}
