import { NextResponse } from "next/server";

import {

  requireSession,

  isSessionUser,

  resolveBusinessId,

  isBusinessAccess,

} from "@/lib/api-auth";

import { db } from "@/lib/db";

import { buildUserAuthFields, sendUserInviteEmail } from "@/lib/user-invite";

import { createUserSchema, listQuerySchema } from "@/lib/validators";



export async function GET(request: Request) {

  const session = await requireSession();

  if (!isSessionUser(session)) return session;



  const { searchParams } = new URL(request.url);

  const access = resolveBusinessId(session, searchParams.get("businessId"));

  if (!isBusinessAccess(access)) return access;

  const businessId = access.businessId;



  const parsed = listQuerySchema.safeParse({

    status: searchParams.get("status") ?? "all",

    page: 1,

    limit: 100,

  });



  if (!parsed.success) {

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  }



  const { status } = parsed.data;

  const users = await db.user.findMany({

    where: {

      businessId,

      ...(status === "active" ? { isActive: true } : {}),

      ...(status === "inactive" ? { isActive: false } : {}),

    },

    orderBy: { createdAt: "desc" },

    select: {

      id: true,

      email: true,

      name: true,

      role: true,

      isActive: true,

      emailVerified: true,

    },

  });



  return NextResponse.json({ users });

}



export async function POST(request: Request) {

  const session = await requireSession();

  if (!isSessionUser(session)) return session;



  const { searchParams } = new URL(request.url);

  const access = resolveBusinessId(session, searchParams.get("businessId"));

  if (!isBusinessAccess(access)) return access;

  const businessId = access.businessId;



  const body = await request.json();

  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {

    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 });

  }



  const sendInvite = parsed.data.sendInvite ?? true;

  const email = parsed.data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {

    return NextResponse.json({ error: "El correo ya está registrado" }, { status: 409 });

  }



  let authFields;

  try {

    authFields = await buildUserAuthFields(sendInvite, parsed.data.password);

  } catch {

    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });

  }



  const user = await db.user.create({

    data: {

      email,

      name: parsed.data.name,

      passwordHash: authFields.passwordHash,

      emailVerified: authFields.emailVerified,

      role: parsed.data.role,

      businessId,

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



  if (sendInvite) {

    try {

      await sendUserInviteEmail(user.id, user.email);

    } catch (err) {

      await db.user.delete({ where: { id: user.id } });

      const detail = err instanceof Error ? err.message : "";
      return NextResponse.json(
        { error: `No se pudo enviar la invitación por correo. ${detail}`.trim() },
        { status: 502 }
      );

    }

  }



  return NextResponse.json({ user, inviteSent: sendInvite }, { status: 201 });

}


