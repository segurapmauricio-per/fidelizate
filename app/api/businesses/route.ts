import { NextResponse } from "next/server";
import { requireSession, isSessionUser, requireSuperAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { buildUserAuthFields, sendUserInviteEmail } from "@/lib/user-invite";
import { createBusinessSchema } from "@/lib/validators";

export async function GET() {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const businesses = await db.business.findMany({
    where: { slug: { not: "platform" } },
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json({ businesses });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const slug = data.slug.toLowerCase();
  const managerEmail = data.managerEmail.toLowerCase();
  const sendInvite = data.sendInvite ?? true;

  const slugTaken = await db.business.findUnique({ where: { slug } });
  if (slugTaken) {
    return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
  }

  const emailTaken = await db.user.findUnique({ where: { email: managerEmail } });
  if (emailTaken) {
    return NextResponse.json({ error: "El correo del manager ya está registrado" }, { status: 409 });
  }

  let authFields;
  try {
    authFields = await buildUserAuthFields(sendInvite, data.managerPassword);
  } catch {
    return NextResponse.json({ error: "Contraseña del manager requerida" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: {
        name: data.name,
        slug,
        primaryColor: data.primaryColor ?? "#e63946",
        rewardAt: data.rewardAt ?? 10,
        ghlPurchaseWebhookUrl: data.ghlPurchaseWebhookUrl,
        ghlRedeemWebhookUrl: data.ghlRedeemWebhookUrl || null,
      },
    });

    const manager = await tx.user.create({
      data: {
        email: managerEmail,
        name: data.managerName,
        passwordHash: authFields.passwordHash,
        emailVerified: authFields.emailVerified,
        role: "MANAGER",
        businessId: created.id,
      },
    });

    return { business: created, manager };
  });

  if (sendInvite) {
    try {
      await sendUserInviteEmail(result.manager.id, result.manager.email);
    } catch (err) {
      await db.$transaction([
        db.user.delete({ where: { id: result.manager.id } }),
        db.business.delete({ where: { id: result.business.id } }),
      ]);
      const detail = err instanceof Error ? err.message : "";
      return NextResponse.json(
        { error: `No se pudo enviar la invitación al manager. ${detail}`.trim() },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      business: {
        id: result.business.id,
        name: result.business.name,
        slug: result.business.slug,
        primaryColor: result.business.primaryColor,
        rewardAt: result.business.rewardAt,
        ghlPurchaseWebhookUrl: result.business.ghlPurchaseWebhookUrl,
        isActive: result.business.isActive,
        createdAt: result.business.createdAt,
        _count: { customers: 0, users: 1 },
      },
      inviteSent: sendInvite,
    },
    { status: 201 }
  );
}
