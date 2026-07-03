import { NextResponse } from "next/server";

import {

  requireManager,

  requireSession,

  isSessionUser,

  resolveCajaBusinessId,

  isBusinessAccess,

} from "@/lib/api-auth";

import { db } from "@/lib/db";

import { updateBusinessSchema } from "@/lib/validators";

import { sendGhlPing, sendGhlRedeemPing } from "@/lib/ghl";



export async function GET(request: Request) {

  const session = await requireSession();

  if (!isSessionUser(session)) return session;



  const access = resolveCajaBusinessId(

    session,

    new URL(request.url).searchParams.get("businessId")

  );

  if (!isBusinessAccess(access)) return access;



  const business = await db.business.findUnique({

    where: { id: access.businessId },

    select: {

      id: true,

      name: true,

      logoUrl: true,

      primaryColor: true,

      rewardAt: true,

      ghlPurchaseWebhookUrl: true,

      ghlRedeemWebhookUrl: true,

    },

  });



  if (!business) {

    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  }



  return NextResponse.json({ business });

}



export async function PATCH(request: Request) {

  const session = await requireSession();

  if (!isSessionUser(session)) return session;



  const denied = requireManager(session);

  if (denied) return denied;



  const body = await request.json();

  const parsed = updateBusinessSchema.safeParse(body);

  if (!parsed.success) {

    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 });

  }



  const data = {

    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),

    ...(parsed.data.logoUrl !== undefined

      ? { logoUrl: parsed.data.logoUrl || null }

      : {}),

    ...(parsed.data.primaryColor !== undefined

      ? { primaryColor: parsed.data.primaryColor }

      : {}),

    ...(parsed.data.rewardAt !== undefined ? { rewardAt: parsed.data.rewardAt } : {}),

    ...(parsed.data.ghlPurchaseWebhookUrl !== undefined

      ? { ghlPurchaseWebhookUrl: parsed.data.ghlPurchaseWebhookUrl || null }

      : {}),

    ...(parsed.data.ghlRedeemWebhookUrl !== undefined

      ? { ghlRedeemWebhookUrl: parsed.data.ghlRedeemWebhookUrl || null }

      : {}),

  };



  const business = await db.business.update({

    where: { id: session.businessId },

    data,

    select: {

      id: true,

      name: true,

      logoUrl: true,

      primaryColor: true,

      rewardAt: true,

      ghlPurchaseWebhookUrl: true,

      ghlRedeemWebhookUrl: true,

    },

  });



  return NextResponse.json({ business });

}



export async function POST(request: Request) {

  const session = await requireSession();

  if (!isSessionUser(session)) return session;



  const denied = requireManager(session);

  if (denied) return denied;



  const { searchParams } = new URL(request.url);

  if (searchParams.get("action") !== "ping") {

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });

  }



  const pingType = searchParams.get("type") === "redeem" ? "redeem" : "purchase";



  const business = await db.business.findUnique({

    where: { id: session.businessId },

    select: { ghlPurchaseWebhookUrl: true, ghlRedeemWebhookUrl: true },

  });



  if (pingType === "redeem") {

    if (!business?.ghlRedeemWebhookUrl) {

      return NextResponse.json({ error: "Webhook de canje no configurado" }, { status: 400 });

    }

    const result = await sendGhlRedeemPing(business.ghlRedeemWebhookUrl);

    if (!result.ok) {

      return NextResponse.json({ error: result.error ?? "Error al enviar ping" }, { status: 502 });

    }

    return NextResponse.json({ ok: true });

  }



  if (!business?.ghlPurchaseWebhookUrl) {

    return NextResponse.json({ error: "Webhook no configurado" }, { status: 400 });

  }



  const result = await sendGhlPing(business.ghlPurchaseWebhookUrl);

  if (!result.ok) {

    return NextResponse.json({ error: result.error ?? "Error al enviar ping" }, { status: 502 });

  }



  return NextResponse.json({ ok: true });

}

