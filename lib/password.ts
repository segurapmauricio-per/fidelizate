import { randomBytes } from "crypto";

export const BCRYPT_ROUNDS = 12;

export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}
