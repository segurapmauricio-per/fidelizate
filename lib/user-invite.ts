import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { TokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { BCRYPT_ROUNDS } from "@/lib/password";
import { issueVerificationToken } from "@/lib/tokens";

export async function sendUserInviteEmail(userId: string, email: string): Promise<void> {
  const plain = await issueVerificationToken(userId, TokenType.EMAIL_VERIFY);
  await sendEmailVerificationEmail(email, plain);
}

export async function buildUserAuthFields(
  sendInvite: boolean,
  password?: string
): Promise<{ passwordHash: string; emailVerified: Date | null }> {
  if (sendInvite) {
    const randomSecret = randomBytes(32).toString("base64url");
    return {
      passwordHash: await hash(randomSecret, BCRYPT_ROUNDS),
      emailVerified: null,
    };
  }

  if (!password) {
    throw new Error("PASSWORD_REQUIRED");
  }

  return {
    passwordHash: await hash(password, BCRYPT_ROUNDS),
    emailVerified: new Date(),
  };
}

export async function countActiveManagers(businessId: string, excludeUserId?: string): Promise<number> {
  return db.user.count({
    where: {
      businessId,
      role: "MANAGER",
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
