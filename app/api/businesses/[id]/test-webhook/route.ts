import { NextResponse } from "next/server";
import { requireSession, isSessionUser, requireSuperAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendGhlPing, sendGhlRedeemPing } from "@/lib/ghl";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireSuperAdmin(session);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const pingType = searchParams.get("type") === "redeem" ? "redeem" : "purchase";

  const business = await db.business.findUnique({
    where: { id: params.id },
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
