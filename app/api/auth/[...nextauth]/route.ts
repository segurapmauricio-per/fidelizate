import { handlers } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const { GET, POST: authPost } = handlers;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`auth:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta en un minuto." },
      { status: 429 }
    );
  }
  return authPost(request);
}

export { GET };
