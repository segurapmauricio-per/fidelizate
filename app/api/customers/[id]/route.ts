import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { formatRut } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;

  const customer = await db.customer.findFirst({
    where: { id: params.id, businessId: access.businessId },
    include: {
      business: { select: { rewardAt: true, primaryColor: true } },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          stampAfter: true,
          rewardTriggered: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      rut: formatRut(customer.rut),
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      stampCount: customer.stampCount,
      totalStamps: customer.totalStamps,
      rewardsEarned: customer.rewardsEarned,
      rewardsRedeemed: customer.rewardsRedeemed,
      rewardPending: customer.rewardPending,
      isActive: customer.isActive,
      lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
      lastRedeemedAt: customer.lastRedeemedAt?.toISOString() ?? null,
      createdAt: customer.createdAt.toISOString(),
      rewardAt: customer.business.rewardAt,
      primaryColor: customer.business.primaryColor,
      sales: customer.sales.map((s) => ({
        id: s.id,
        stampAfter: s.stampAfter,
        rewardTriggered: s.rewardTriggered,
        createdAt: s.createdAt.toISOString(),
      })),
    },
  });
}
