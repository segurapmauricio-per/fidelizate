import { NextResponse } from "next/server";
import { requireSession, isSessionUser, requireSuperAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { updateBusinessAdminSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const parsed = updateBusinessAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const existing = await db.business.findUnique({ where: { id: params.id } });
  if (!existing || existing.slug === "platform") {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const business = await db.business.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.primaryColor !== undefined ? { primaryColor: parsed.data.primaryColor } : {}),
      ...(parsed.data.rewardAt !== undefined ? { rewardAt: parsed.data.rewardAt } : {}),
      ...(parsed.data.ghlPurchaseWebhookUrl !== undefined
        ? { ghlPurchaseWebhookUrl: parsed.data.ghlPurchaseWebhookUrl }
        : {}),
      ...(parsed.data.ghlRedeemWebhookUrl !== undefined
        ? { ghlRedeemWebhookUrl: parsed.data.ghlRedeemWebhookUrl || null }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryColor: true,
      rewardAt: true,
      ghlPurchaseWebhookUrl: true,
      isActive: true,
      createdAt: true,
      _count: { select: { customers: true, users: true } },
    },
  });

  return NextResponse.json({ business });
}
