import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateAutoPostSourceConfig } from "@/lib/autopost/service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      rssUrl?: string;
      enabled?: boolean;
      immediatePublishEnabled?: boolean;
      assetsPersistenceEnabled?: boolean;
    };

    const result = await updateAutoPostSourceConfig(user.id, body);
    return NextResponse.json({ ok: true, config: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
