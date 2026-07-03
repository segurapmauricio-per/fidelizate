import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { listQuerySchema } from "@/lib/validators";
import { formatRut } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const { searchParams } = new URL(request.url);
  const access = resolveBusinessId(session, searchParams.get("businessId"));
  if (!isBusinessAccess(access)) return access;
  const businessId = access.businessId;

  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? "all",
    query: searchParams.get("query") ?? undefined,
    page: searchParams.get("page") ?? 1,
    limit: searchParams.get("limit") ?? 20,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { status, query, page, limit } = parsed.data;
  const where = {
    businessId,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { rut: { contains: query.replace(/[^0-9kK]/g, "") } },
          ],
        }
      : {}),
  };

  const [customers, total, business] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.customer.count({ where }),
    db.business.findUnique({
      where: { id: businessId },
      select: { rewardAt: true },
    }),
  ]);

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      rut: formatRut(c.rut),
      name: c.name,
      stampCount: c.stampCount,
      rewardAt: business?.rewardAt ?? 10,
      isActive: c.isActive,
      lastPurchaseAt: c.sales[0]?.createdAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  });
}
