import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { requireEnv, getOptionalEnv } from "@/lib/env";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userId: string;
      role: Role;
      businessId: string;
      email: string;
      emailVerified?: Date | null;
      mustChangePassword?: boolean;
      name?: string | null;
    };
  }

  interface User {
    userId: string;
    role: Role;
    businessId: string;
    mustChangePassword?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleEnabled =
  Boolean(getOptionalEnv("GOOGLE_CLIENT_ID")) &&
  Boolean(getOptionalEnv("GOOGLE_CLIENT_SECRET"));

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: requireEnv("AUTH_SECRET"),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: getOptionalEnv("GOOGLE_CLIENT_ID")!,
            clientSecret: getOptionalEnv("GOOGLE_CLIENT_SECRET")!,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = (profile?.email ?? user.email)?.toLowerCase();
        if (!email) return false;

        const existing = await db.user.findUnique({ where: { email } });
        if (!existing || !existing.isActive) return false;

        if (!existing.googleId && account.providerAccountId) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              googleId: account.providerAccountId,
              emailVerified: existing.emailVerified ?? new Date(),
              lastLoginAt: new Date(),
            },
          });
        } else {
          await db.user.update({
            where: { id: existing.id },
            data: {
              emailVerified: existing.emailVerified ?? new Date(),
              lastLoginAt: new Date(),
            },
          });
        }

        user.userId = existing.id;
        user.role = existing.role;
        user.businessId = existing.businessId;
        user.mustChangePassword = existing.mustChangePassword;
        return true;
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user?.userId) {
        token.userId = user.userId;
        token.role = user.role;
        token.businessId = user.businessId;
        if (user.mustChangePassword !== undefined) {
          token.mustChangePassword = user.mustChangePassword;
        }
      }

      if (account?.provider === "google" && token.email) {
        const existing = await db.user.findUnique({
          where: { email: token.email.toLowerCase() },
        });
        if (existing?.isActive) {
          token.userId = existing.id;
          token.role = existing.role;
          token.businessId = existing.businessId;
          token.mustChangePassword = existing.mustChangePassword;
        }
      }

      if (trigger === "update" && session && "mustChangePassword" in session) {
        token.mustChangePassword = Boolean(session.mustChangePassword);
      }

      return token;
    },
  },
});

export const isGoogleAuthEnabled = googleEnabled;
