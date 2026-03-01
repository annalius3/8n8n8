import { NextRequest, NextResponse } from "next/server";
import { createSignedStateToken, getCurrentUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/connections", request.url));
  }

  const env = getServerEnv();
  if (!env.PINTEREST_CLIENT_ID || !env.PINTEREST_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/connections?error=pinterest_oauth_not_configured", request.url));
  }

  const connectionName = request.nextUrl.searchParams.get("name")?.trim() || "Main Pinterest";
  const redirectUri = joinUrl(getRequestOrigin(request.url), "/connections/pinterest/callback");
  const state = createSignedStateToken({
    provider: "pinterest",
    userId: user.id,
    connectionName
  });

  const authorizeUrl = new URL("https://www.pinterest.com/oauth/");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", env.PINTEREST_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "boards:read,pins:read,boards:write,pins:write,user_accounts:read");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
