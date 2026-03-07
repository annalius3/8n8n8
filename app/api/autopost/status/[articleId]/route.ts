import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAutoPostStatus } from "@/lib/autopost/service";

type Params = { params: Promise<{ articleId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { articleId } = await params;
    const status = await getAutoPostStatus(user.id, articleId);
    return NextResponse.json({ ok: true, article: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
