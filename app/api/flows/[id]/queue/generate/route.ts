import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { toPublicOpenAIErrorMessage } from "@/lib/campaigns/openai";
import { generateContentForQueueItems } from "@/lib/campaigns/service";

const schema = z.object({
  queueItemIds: z.array(z.string().min(1)).min(1)
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    await generateContentForQueueItems(id, user.id, parsed.data.queueItemIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toPublicOpenAIErrorMessage(error) }, { status: 400 });
  }
}
