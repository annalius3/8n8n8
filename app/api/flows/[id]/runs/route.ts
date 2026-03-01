import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/active-user";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const queueItemId = request.nextUrl.searchParams.get("queueItemId") ?? undefined;

  const runs = await prisma.jobRun.findMany({
    where: {
      flowId: id,
      flow: { userId: user.id },
      ...(queueItemId ? { queueItemId } : {})
    },
    include: {
      steps: { orderBy: { stepIndex: "asc" } }
    },
    orderBy: { startedAt: "desc" },
    take: queueItemId ? 20 : 50
  });

  return NextResponse.json({ runs });
}


