import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { statusPatchSchema } from "@/lib/validators";
import { countActiveManagers } from "@/lib/user-invite";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const body = await request.json();
  const parsed = statusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { id: params.id, businessId: access.businessId },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.id === session.userId && !parsed.data.isActive) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  if (!parsed.data.isActive && user.role === "MANAGER" && user.isActive) {
    const others = await countActiveManagers(access.businessId, user.id);
    if (others === 0) {
      return NextResponse.json(
        { error: "El negocio debe tener al menos un manager activo" },
        { status: 400 }
      );
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      isActive: parsed.data.isActive,
      deactivatedAt: parsed.data.isActive ? null : new Date(),
    },
    select: {
      id: true,
      isActive: true,
      deactivatedAt: true,
    },
  });

  return NextResponse.json({ user: updated });
}
