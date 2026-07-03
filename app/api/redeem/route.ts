import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveCajaBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { redeemSchema } from "@/lib/validators";
import { redeemReward } from "@/lib/redeem";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveCajaBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const body = await request.json();
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const result = await redeemReward({
      customerId: parsed.data.customerId,
      businessId: access.businessId,
    });
    return NextResponse.json({
      rewardsRedeemed: result.rewardsRedeemed,
      ghlSynced: result.ghlSynced,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "NO_REWARD_PENDING") {
      return NextResponse.json({ error: "El cliente no tiene premio pendiente" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al canjear premio" }, { status: 500 });
  }
}
