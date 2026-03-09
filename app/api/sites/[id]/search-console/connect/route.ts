import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { createSearchConsoleStateToken, buildSearchConsoleAuthUrl } from "@/lib/sites/google-search-console";
import { getRequestOrigin, joinUrl } from "@/lib/oauth";
import { getSiteForUser } from "@/lib/sites/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/sites", request.url));
  }

  const { id } = await params;
  await getSiteForUser(id, user.id);

  const state = createSearchConsoleStateToken({
    userId: user.id,
    siteId: id,
    next: `/sites/${id}?tab=settings`
  });

  const redirectUri = joinUrl(getRequestOrigin(request.url), "/sites/google/callback");
  return NextResponse.redirect(buildSearchConsoleAuthUrl({ redirectUri, state }));
}
