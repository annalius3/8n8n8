import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifySignedStateToken } from "@/lib/auth";
import { getOptionalServerEnvValue } from "@/lib/env";
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

function buildErrorRedirect(requestUrl: string, code: string, reason?: string) {
  const url = new URL("/login", requestUrl);
  url.searchParams.set("error", code);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return NextResponse.redirect(url);
}

function toReasonCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();

  if (message.includes("redirect_uri_mismatch")) return "redirect_uri_mismatch";
  if (message.includes("invalid_client")) return "invalid_client";
  if (message.includes("invalid_grant")) return "invalid_grant";
  if (message.includes("missing email")) return "missing_email";
  if (message.includes("environment") || message.includes("auth_secret")) return "auth_setup";
  if (message.includes("prisma") || message.includes("database") || message.includes("p1000") || message.includes("p1001")) {
    return "auth_setup";
  }

  return "oauth_failed";
}

export async function GET(request: NextRequest) {
  const clientId = getOptionalServerEnvValue("GOOGLE_CLIENT_ID");
  const clientSecret = getOptionalServerEnvValue("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return buildErrorRedirect(request.url, "google_not_configured");
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");

  if (!code || !stateToken) {
    return buildErrorRedirect(request.url, "google_oauth", "missing_code_or_state");
  }

  const state = verifySignedStateToken<GoogleState>(stateToken);
  if (!state || state.provider !== "google") {
    return buildErrorRedirect(request.url, "google_oauth", "invalid_state");
  }

  try {
    const redirectUri = joinUrl(getRequestOrigin(request.url), "/auth/google/callback");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
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
  } catch (error) {
    const reason = toReasonCode(error);
    console.error("Google OAuth callback failed", {
      reason,
      error: error instanceof Error ? error.message : String(error ?? "")
    });
    return buildErrorRedirect(request.url, reason === "auth_setup" ? "auth_setup" : "google_oauth", reason);
  }
}
