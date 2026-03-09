import { NextRequest, NextResponse } from "next/server";
import { SearchConsolePeriod } from "@prisma/client";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { getSiteAnalytics } from "@/lib/sites/service";

const periodSchema = z.nativeEnum(SearchConsolePeriod).optional();

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = periodSchema.safeParse(request.nextUrl.searchParams.get("period") ?? undefined);
  const { id } = await params;
  const analytics = await getSiteAnalytics({
    siteId: id,
    userId: user.id,
    period: parsed.success ? parsed.data : undefined
  });

  return NextResponse.json(analytics);
}
