import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyMagicToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = verifyMagicToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: {},
    create: {
      email: payload.email,
      name: payload.email.split("@")[0]
    }
  });

  const response = NextResponse.redirect(new URL("/flows", request.url));
  setAuthCookie(response, user.id);
  return response;
}
