import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { statusPatchSchema } from "@/lib/validators";

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

  const customer = await db.customer.findFirst({
    where: { id: params.id, businessId: access.businessId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const updated = await db.customer.update({
    where: { id: customer.id },
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

  return NextResponse.json({ customer: updated });
}
