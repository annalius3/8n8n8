import { NextRequest, NextResponse } from "next/server";
import { createSignedStateToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }

  const nextPath = request.nextUrl.searchParams.get("next");
  const redirectUri = joinUrl(getRequestOrigin(request.url), "/auth/google/callback");
  const state = createSignedStateToken({
    provider: "google",
    next: nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/flows"
  });

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("prompt", "select_account");
  googleUrl.searchParams.set("state", state);

  return NextResponse.redirect(googleUrl);
}
