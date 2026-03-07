import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAutoPostDashboard } from "@/lib/autopost/service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const dashboard = await getAutoPostDashboard(user.id);
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
