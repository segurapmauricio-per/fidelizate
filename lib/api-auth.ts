import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export type SessionUser = {
  userId: string;
  role: Role;
  businessId: string;
  email: string;
  name?: string | null;
};

export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await auth();
  if (!session?.user?.userId || !session.user.role || !session.user.businessId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return {
    userId: session.user.userId,
    role: session.user.role as Role,
    businessId: session.user.businessId,
    email: session.user.email ?? "",
    name: session.user.name,
  };
}

export function requireManager(user: SessionUser): NextResponse | null {
  if (user.role !== "MANAGER") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }
  return null;
}

export function requireSuperAdmin(user: SessionUser): NextResponse | null {
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }
  return null;
}

export type BusinessAccess = { businessId: string };

// Resuelve sobre qué negocio actúa la petición:
// - MANAGER: solo el suyo (un businessId distinto = 403).
// - SUPER_ADMIN: cualquiera, pasado por ?businessId=.
// - CASHIER u otro: prohibido.
export function resolveBusinessId(
  user: SessionUser,
  requested: string | null
): BusinessAccess | NextResponse {
  if (user.role === "MANAGER") {
    if (requested && requested !== user.businessId) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }
    return { businessId: user.businessId };
  }
  if (user.role === "SUPER_ADMIN") {
    if (!requested) {
      return NextResponse.json({ error: "businessId requerido" }, { status: 400 });
    }
    return { businessId: requested };
  }
  return NextResponse.json({ error: "Prohibido" }, { status: 403 });
}

export function isBusinessAccess(
  value: BusinessAccess | NextResponse
): value is BusinessAccess {
  return "businessId" in value;
}

// Como resolveBusinessId, pero para la CAJA: tambien permite al CASHIER
// operar sobre su propio negocio.
export function resolveCajaBusinessId(
  user: SessionUser,
  requested: string | null
): BusinessAccess | NextResponse {
  if (user.role === "CASHIER" || user.role === "MANAGER") {
    if (requested && requested !== user.businessId) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }
    return { businessId: user.businessId };
  }
  if (user.role === "SUPER_ADMIN") {
    if (!requested) {
      return NextResponse.json({ error: "businessId requerido" }, { status: 400 });
    }
    return { businessId: requested };
  }
  return NextResponse.json({ error: "Prohibido" }, { status: 403 });
}

export function isSessionUser(value: SessionUser | NextResponse): value is SessionUser {
  return "userId" in value;
}
