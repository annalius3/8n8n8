import { SocialPlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publishForArticle } from "@/lib/autopost/service";

type Params = { params: Promise<{ articleId: string; platform: string }> };

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

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { articleId, platform } = await params;
    const parsedPlatform = toPlatform(platform);
    if (!parsedPlatform) {
      return NextResponse.json({ ok: false, error: "Unsupported platform" }, { status: 400 });
    }
    const result = await publishForArticle(user.id, articleId, parsedPlatform);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
