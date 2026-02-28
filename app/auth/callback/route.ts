import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyMagicToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const nextPath = request.nextUrl.searchParams.get("next");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = verifyMagicToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {},
      create: {
        email: payload.email,
        name: payload.email.split("@")[0]
      }
    });

    const redirectTarget = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/flows";
    const response = NextResponse.redirect(new URL(redirectTarget, request.url));
    setAuthCookie(response, user.id);
    return response;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "auth_setup");
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      loginUrl.searchParams.set("next", nextPath);
    }

    return NextResponse.redirect(loginUrl);
  }
}
