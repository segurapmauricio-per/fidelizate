import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const access = resolveBusinessId(
    session,
    new URL(request.url).searchParams.get("businessId")
  );
  if (!isBusinessAccess(access)) return access;
  const businessId = access.businessId;

  const today = startOfToday();

  const [activeCustomers, stampsToday, rewardsToday, activeCashiers] = await Promise.all([
    db.customer.count({
      where: { businessId, isActive: true },
    }),
    db.sale.count({
      where: {
        createdAt: { gte: today },
        customer: { businessId },
      },
    }),
    db.sale.count({
      where: {
        createdAt: { gte: today },
        rewardTriggered: true,
        customer: { businessId },
      },
    }),
    db.user.count({
      where: { businessId, role: "CASHIER", isActive: true },
    }),
  ]);

  return NextResponse.json({
    activeCustomers,
    stampsToday,
    rewardsToday,
    activeCashiers,
  });
}
