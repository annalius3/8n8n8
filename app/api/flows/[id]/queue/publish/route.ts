import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { publishQueueItems } from "@/lib/campaigns/service";

const schema = z.object({
  queueItemIds: z.array(z.string().min(1)).optional(),
  dueOnly: z.boolean().optional()
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

  const { id } = await params;
  const result = await publishQueueItems({
    flowId: id,
    userId: user.id,
    queueItemIds: parsed.data.queueItemIds,
    dueOnly: parsed.data.dueOnly
  });

  return NextResponse.json(result);
}

