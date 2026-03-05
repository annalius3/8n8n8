import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { runSchedulerTick } from "@/lib/worker/scheduler";

function isSchedulerTokenValid(request: NextRequest, expected: string) {
  const fromHeader = request.headers.get("x-scheduler-token") ?? "";
  const fromQuery = request.nextUrl.searchParams.get("token") ?? "";

  return fromHeader === expected || fromQuery === expected;
}

async function handleTick(request: NextRequest) {
  const env = getServerEnv();
  const schedulerAllowed = isSchedulerTokenValid(request, env.SCHEDULER_TOKEN);

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  if (!user && !schedulerAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSchedulerTick();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return handleTick(request);
}
