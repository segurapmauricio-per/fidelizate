import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { requireSession, isSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { BCRYPT_ROUNDS } from "@/lib/password";
import { changeOwnPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const body = await request.json();
  const parsed = changeOwnPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "No puedes cambiar la contraseña de esta cuenta" }, { status: 400 });
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "La nueva contraseña debe ser distinta" }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.newPassword, BCRYPT_ROUNDS);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
