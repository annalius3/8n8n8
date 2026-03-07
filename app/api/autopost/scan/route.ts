import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { scanAndQueueNewArticles } from "@/lib/autopost/service";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const result = await scanAndQueueNewArticles(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
