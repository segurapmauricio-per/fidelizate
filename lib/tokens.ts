import { createHash, randomBytes } from "crypto";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/db";

const TOKEN_BYTES = 32;

const EXPIRY_MS: Record<TokenType, number> = {
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hora
  EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24 horas
};

export function generatePlainToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export async function issueVerificationToken(
  userId: string,
  type: TokenType
): Promise<string> {
  const plain = generatePlainToken();
  const tokenHash = hashToken(plain);
  const expiresAt = new Date(Date.now() + EXPIRY_MS[type]);

  await db.$transaction([
    db.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.verificationToken.create({
      data: { userId, type, tokenHash, expiresAt },
    }),
  ]);

  return plain;
}

export type ValidatedToken = {
  id: string;
  userId: string;
  type: TokenType;
};

export async function validateVerificationToken(
  plain: string,
  expectedType: TokenType
): Promise<ValidatedToken | null> {
  const tokenHash = hashToken(plain);
  const record = await db.verificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.type !== expectedType) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await db.verificationToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
