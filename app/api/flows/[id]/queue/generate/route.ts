import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { toPublicOpenAIErrorMessage } from "@/lib/campaigns/openai";
import { generateContentForQueueItems, runGenerateAllPipeline } from "@/lib/campaigns/service";

const schema = z.object({
  queueItemIds: z.array(z.string().min(1)).min(1).optional(),
  autoPipeline: z.boolean().optional()
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;

    if (parsed.data.autoPipeline) {
      const result = await runGenerateAllPipeline(id, user.id);
      return NextResponse.json(result);
    }

    if (!parsed.data.queueItemIds?.length) {
      return NextResponse.json({ error: "Нужно выбрать элементы очереди для генерации" }, { status: 400 });
    }

    const result = await generateContentForQueueItems(id, user.id, parsed.data.queueItemIds);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: toPublicOpenAIErrorMessage(error) }, { status: 400 });
  }
}
