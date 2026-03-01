import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { retryFailedQueueItems } from "@/lib/campaigns/service";

const schema = z.object({
  queueItemIds: z.array(z.string().min(1)).min(1)
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const result = await retryFailedQueueItems(id, user.id, parsed.data.queueItemIds);
  return NextResponse.json(result);
}


