import type { NextAuthConfig } from "next-auth";
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
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user && "userId" in user) {
        token.userId = user.userId as string;
        token.role = user.role as Role;
        token.businessId = user.businessId as string;
        if ("mustChangePassword" in user) {
          token.mustChangePassword = Boolean(user.mustChangePassword);
        }
      }

      if (trigger === "update" && session && "mustChangePassword" in session) {
        token.mustChangePassword = Boolean(session.mustChangePassword);
      }

      return token;
    },
    async session({ session, token }) {
      if (token.userId && token.role && token.businessId) {
        session.user = {
          id: token.userId as string,
          userId: token.userId as string,
          role: token.role as Role,
          businessId: token.businessId as string,
          email: session.user?.email ?? (token.email as string) ?? "",
          emailVerified: null,
          mustChangePassword: Boolean(token.mustChangePassword),
          name: session.user?.name,
        };
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
