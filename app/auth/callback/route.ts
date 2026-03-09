import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyMagicToken } from "@/lib/auth";

function detectAuthSetupReason(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();

  if (message.includes("auth_secret")) return "auth_secret_missing";
  if (message.includes("p1000") || message.includes("p1001") || message.includes("database")) return "db_unavailable";
  if (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("column") ||
    message.includes("table") ||
    message.includes("p2021") ||
    message.includes("p2022")
  ) {
    return "db_schema";
  }

  return "auth_setup";
}

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
  } catch (error) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "auth_setup");
    loginUrl.searchParams.set("reason", detectAuthSetupReason(error));
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      loginUrl.searchParams.set("next", nextPath);
    }

    return NextResponse.redirect(loginUrl);
  }
}
