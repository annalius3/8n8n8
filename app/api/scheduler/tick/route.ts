import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { getCurrentUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { runSchedulerTick } from "@/lib/worker/scheduler";

function isTokenValid(request: NextRequest) {
  const expected = getServerEnv().SCHEDULER_TOKEN;
  if (!expected) {
    return false;
  }

  const fromHeader = request.headers.get("x-scheduler-token") ?? "";
  const fromQuery = request.nextUrl.searchParams.get("token") ?? "";

  return fromHeader === expected || fromQuery === expected;
}

export async function POST(request: NextRequest) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  const allowDemoAccess = process.env.NODE_ENV !== "production";
  if (!user && allowDemoAccess) {
    user = await getActiveUser();
  }

  if (!user && !isTokenValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSchedulerTick();
  return NextResponse.json(result);
}
