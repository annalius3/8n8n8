import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/worker/cron";

type Params = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  isEnabled: z.boolean().optional(),
  language: z.enum(["EN", "RU", "UA"]).optional(),
  postsPerDay: z.number().int().min(1).max(50).optional(),
  startTime: z.string().min(4).optional(),
  autopublishEnabled: z.boolean().optional(),
  niche: z.string().optional(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  cron: z.string().min(5).optional(),
  timezone: z.string().optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
  isPaused: z.boolean().optional()
});

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } },
      topicSuggestions: { orderBy: { createdAt: "asc" } },
      queueItems: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!flow) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json(flow);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: { schedule: true }
  });
  if (!flow) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const data = parsed.data;

  await prisma.flow.update({
    where: { id: flow.id },
    data: {
      name: data.name,
      isEnabled: data.isEnabled,
      language: data.language,
      postsPerDay: data.postsPerDay,
      timezone: data.timezone,
      startTime: data.startTime,
      autopublishEnabled: data.autopublishEnabled,
      niche: data.niche,
      audience: data.audience,
      tone: data.tone
    }
  });

  if (flow.schedule && (data.cron || data.timezone || data.maxRunsPerDay || data.postsPerDay || data.isPaused !== undefined)) {
    const cron = data.cron ?? flow.schedule.cron;
    const timezone = data.timezone ?? flow.schedule.timezone;
    const maxRunsPerDay = data.maxRunsPerDay ?? data.postsPerDay ?? flow.schedule.maxRunsPerDay;

    await prisma.flowSchedule.update({
      where: { flowId: flow.id },
      data: {
        cron,
        timezone,
        maxRunsPerDay,
        isPaused: data.isPaused,
        nextRunAt: computeNextRunAt(cron, timezone)
      }
    });
  }

  const updated = await prisma.flow.findUnique({
    where: { id: flow.id },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } },
      topicSuggestions: { orderBy: { createdAt: "asc" } },
      queueItems: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }] }
    }
  });

  return NextResponse.json(updated);
}
