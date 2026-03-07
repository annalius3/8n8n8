import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publishForArticle } from "@/lib/autopost/service";

type Params = { params: Promise<{ articleId: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { articleId } = await params;
    const result = await publishForArticle(user.id, articleId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
