import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";
import { getCurrentUser, verifySignedStateToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";

type PinterestState = {
  provider: "pinterest";
  userId: string;
  connectionName: string;
};

type PinterestTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  status?: string;
  code?: string;
  message?: string;
};

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  const env = getServerEnv();

  if (!env.PINTEREST_CLIENT_ID || !env.PINTEREST_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/connections?error=pinterest_oauth_not_configured", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");
  if (!code || !stateToken) {
    return NextResponse.redirect(new URL("/connections?error=pinterest_oauth", request.url));
  }

  const state = verifySignedStateToken<PinterestState>(stateToken);
  if (!state || state.provider !== "pinterest") {
    return NextResponse.redirect(new URL("/connections?error=pinterest_oauth", request.url));
  }

  if (!currentUser || currentUser.id !== state.userId) {
    return NextResponse.redirect(new URL("/login?next=/connections", request.url));
  }

  try {
    const redirectUri = joinUrl(getRequestOrigin(request.url), "/connections/pinterest/callback");
    const basicAuth = Buffer.from(`${env.PINTEREST_CLIENT_ID}:${env.PINTEREST_CLIENT_SECRET}`).toString("base64");

    const tokenResponse = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      }),
      cache: "no-store"
    });

    const tokenData = (await tokenResponse.json().catch(() => ({}))) as PinterestTokenResponse;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.message || tokenData.code || tokenData.status || "Pinterest token exchange failed");
    }

    const encryptedJson = encryptToken(
      JSON.stringify({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
        updatedAt: new Date().toISOString()
      })
    );

    const existing = await prisma.connection.findFirst({
      where: {
        userId: currentUser.id,
        provider: "pinterest",
        name: state.connectionName
      },
      select: { id: true }
    });

    if (existing) {
      await prisma.connection.update({
        where: { id: existing.id },
        data: { encryptedJson }
      });
    } else {
      await prisma.connection.create({
        data: {
          userId: currentUser.id,
          provider: "pinterest",
          name: state.connectionName,
          encryptedJson
        }
      });
    }

    return NextResponse.redirect(new URL("/connections?success=pinterest_oauth", request.url));
  } catch {
    return NextResponse.redirect(new URL("/connections?error=pinterest_oauth", request.url));
  }
}
