import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifySignedStateToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";

type GoogleState = {
  provider: "google";
  next?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
  picture?: string;
};

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");

  if (!code || !stateToken) {
    return NextResponse.redirect(new URL("/login?error=google_oauth", request.url));
  }

  const state = verifySignedStateToken<GoogleState>(stateToken);
  if (!state || state.provider !== "google") {
    return NextResponse.redirect(new URL("/login?error=google_oauth", request.url));
  }

  try {
    const redirectUri = joinUrl(getRequestOrigin(request.url), "/auth/google/callback");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      cache: "no-store"
    });

    const tokenData = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed");
    }

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      },
      cache: "no-store"
    });

    const userData = (await userResponse.json().catch(() => ({}))) as GoogleUserInfo;
    if (!userResponse.ok || !userData.email) {
      throw new Error("Google user profile is missing email");
    }

    const user = await prisma.user.upsert({
      where: { email: userData.email.toLowerCase().trim() },
      update: {
        name: userData.name?.trim() || userData.email.split("@")[0]
      },
      create: {
        email: userData.email.toLowerCase().trim(),
        name: userData.name?.trim() || userData.email.split("@")[0]
      }
    });

    const nextPath = state.next && state.next.startsWith("/") && !state.next.startsWith("//") ? state.next : "/flows";
    const response = NextResponse.redirect(new URL(nextPath, request.url));
    setAuthCookie(response, user.id);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_oauth", request.url));
  }
}
