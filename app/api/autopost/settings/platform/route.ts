import { SocialPlatform } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateAutoPostPlatformSetting } from "@/lib/autopost/service";

function toPlatform(value: string): SocialPlatform | null {
  if (
    value === "twitter" ||
    value === "linkedin" ||
    value === "reddit" ||
    value === "telegram" ||
    value === "pinterest" ||
    value === "medium" ||
    value === "facebook"
  ) {
    return value;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      platform: string;
      enabled?: boolean;
      maxPostsPerDay?: number;
      minIntervalMinutes?: number;
      requireApproval?: boolean;
    };

    const platform = toPlatform(body.platform);
    if (!platform) {
      return NextResponse.json({ ok: false, error: "Unsupported platform" }, { status: 400 });
    }

    const result = await updateAutoPostPlatformSetting(user.id, platform, {
      enabled: body.enabled,
      maxPostsPerDay: body.maxPostsPerDay,
      minIntervalMinutes: body.minIntervalMinutes,
      requireApproval: body.requireApproval
    });
    return NextResponse.json({ ok: true, setting: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
