import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";
import { exchangeSearchConsoleCode, verifySearchConsoleStateToken } from "@/lib/sites/google-search-console";
import { upsertSearchConsoleConnection } from "@/lib/sites/service";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");

  if (!code || !stateToken) {
    return NextResponse.redirect(new URL("/sites?error=search_console_oauth", request.url));
  }

  const state = verifySearchConsoleStateToken(stateToken);
  if (!state || state.provider !== "google_search_console") {
    return NextResponse.redirect(new URL("/sites?error=search_console_oauth", request.url));
  }

  if (!currentUser || currentUser.id !== state.userId) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(state.next ?? "/sites")}`, request.url));
  }

  try {
    const secret = await exchangeSearchConsoleCode({
      code,
      redirectUri: joinUrl(getRequestOrigin(request.url), "/sites/google/callback")
    });

    await upsertSearchConsoleConnection({
      siteId: state.siteId,
      userId: currentUser.id,
      secret
    });

    return NextResponse.redirect(new URL(state.next ?? `/sites/${state.siteId}?tab=settings`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/sites/${state.siteId}?tab=settings&error=search_console_oauth`, request.url));
  }
}
