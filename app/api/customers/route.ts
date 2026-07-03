import { NextResponse } from "next/server";
import {
  requireSession,
  isSessionUser,
  resolveCajaBusinessId,
  isBusinessAccess,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { createCustomerSchema, customerSearchSchema } from "@/lib/validators";
import { normalizeAndValidateRut } from "@/lib/rut";
import { formatRut } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const { searchParams } = new URL(request.url);
  const access = resolveCajaBusinessId(session, searchParams.get("businessId"));
  if (!isBusinessAccess(access)) return access;

  const parsed = customerSearchSchema.safeParse({ rut: searchParams.get("rut") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }

  const rut = normalizeAndValidateRut(parsed.data.rut);
  if (!rut) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }

  const customer = await db.customer.findFirst({
    where: { businessId: access.businessId, rut, isActive: true },
    include: {
      business: { select: { rewardAt: true, primaryColor: true, logoUrl: true, name: true } },
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
      rewardPending: customer.rewardPending,
      rewardAt: customer.business.rewardAt,
      primaryColor: customer.business.primaryColor,
      logoUrl: customer.business.logoUrl,
      businessName: customer.business.name,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const { searchParams } = new URL(request.url);
  const access = resolveCajaBusinessId(session, searchParams.get("businessId"));
  if (!isBusinessAccess(access)) return access;
  const businessId = access.businessId;

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const rut = normalizeAndValidateRut(parsed.data.rut);
  if (!rut) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }

  const existing = await db.customer.findUnique({
    where: { businessId_rut: { businessId, rut } },
  });

  if (existing) {
    return NextResponse.json({ error: "El cliente ya existe" }, { status: 409 });
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { rewardAt: true, primaryColor: true, logoUrl: true, name: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const customer = await db.customer.create({
    data: {
      businessId,
      rut,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });

  return NextResponse.json(
    {
      customer: {
        id: customer.id,
        rut: formatRut(customer.rut),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        stampCount: customer.stampCount,
        rewardAt: business.rewardAt,
        primaryColor: business.primaryColor,
        logoUrl: business.logoUrl,
        businessName: business.name,
      },
    },
    { status: 201 }
  );
}
