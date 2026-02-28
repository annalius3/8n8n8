import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
