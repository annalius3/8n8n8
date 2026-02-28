import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { createCampaign, generateTopicsForCampaign } from "@/lib/campaigns/service";

const schema = z.object({
  name: z.string().trim().min(2).optional(),
  seedTopic: z.string().trim().min(3),
  language: z.enum(["EN", "RU", "UA"]),
  niche: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  postsPerDay: z.number().int().min(1).max(50).default(3),
  timezone: z.string().trim().default("Europe/Kiev"),
  startTime: z.string().trim().default("09:00"),
  autopublishEnabled: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const flow = await createCampaign(user.id, parsed.data);
  const result = await generateTopicsForCampaign(flow.id, user.id);

  return NextResponse.json({
    flowId: result.flowId,
    runId: result.runId
  });
}
