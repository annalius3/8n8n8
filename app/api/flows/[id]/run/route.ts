import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { runFlowNow } from "@/lib/worker/runner";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id }
  });

  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runId = await runFlowNow(flow.id);
  return NextResponse.json({ runId });
}
