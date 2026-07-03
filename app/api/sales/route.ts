import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveCajaBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { createSaleSchema } from "@/lib/validators";
import { registerPurchase } from "@/lib/sales";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveCajaBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const body = await request.json();
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const result = await registerPurchase({
      customerId: parsed.data.customerId,
      cashierId: session.userId,
      businessId: access.businessId,
    });

    return NextResponse.json({
      displayCount: result.displayCount,
      rewardTriggered: result.rewardTriggered,
      persistedCount: result.persistedCount,
      ghlSynced: result.ghlSynced,
      saleId: result.saleId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al registrar compra" }, { status: 500 });
  }
}
