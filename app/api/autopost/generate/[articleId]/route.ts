import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateForArticle } from "@/lib/autopost/service";

type Params = { params: Promise<{ articleId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { articleId } = await params;
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const result = await generateForArticle(user.id, articleId, Boolean(body.force));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
