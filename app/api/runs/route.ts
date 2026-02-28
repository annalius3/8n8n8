import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getActiveUser();

  const runs = await prisma.jobRun.findMany({
    where: {
      flow: {
        userId: user.id
      }
    },
    include: {
      flow: true,
      steps: {
        orderBy: { stepIndex: "asc" }
      }
    },
    orderBy: {
      startedAt: "desc"
    },
    take: 100
  });

  return NextResponse.json(runs);
}
