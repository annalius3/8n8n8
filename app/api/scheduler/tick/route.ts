import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runSchedulerTick } from "@/lib/worker/scheduler";

function isTokenValid(request: NextRequest) {
  const expected = process.env.SCHEDULER_TOKEN;
  if (!expected) {
    return false;
  }

  const fromHeader = request.headers.get("x-scheduler-token") ?? "";
  const fromQuery = request.nextUrl.searchParams.get("token") ?? "";

  return fromHeader === expected || fromQuery === expected;
}

export async function POST(request: NextRequest) {
  const hasSchedulerToken = Boolean(process.env.SCHEDULER_TOKEN);

  if (hasSchedulerToken) {
    if (!isTokenValid(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runSchedulerTick();
  return NextResponse.json(result);
}
