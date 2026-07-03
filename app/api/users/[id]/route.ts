import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { countActiveManagers } from "@/lib/user-invite";
import { updateUserSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const target = await db.user.findFirst({
    where: { id: params.id, businessId: access.businessId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const newRole = parsed.data.role ?? target.role;
  const wasManager = target.role === "MANAGER" && target.isActive;
  const willStopBeingManager = wasManager && newRole !== "MANAGER";

  if (willStopBeingManager) {
    const others = await countActiveManagers(access.businessId, target.id);
    if (others === 0) {
      return NextResponse.json(
        { error: "El negocio debe tener al menos un manager activo" },
        { status: 400 }
      );
    }
  }

  if (parsed.data.email) {
    const email = parsed.data.email.toLowerCase();
    if (email !== target.email) {
      const taken = await db.user.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json({ error: "El correo ya está registrado" }, { status: 409 });
      }
    }
  }

  const user = await db.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email.toLowerCase() } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
    },
  });

  return NextResponse.json({ user });
}
