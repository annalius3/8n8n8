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
  isPaused: z.boolean().optional(),
  pinterestConnectionName: z.string().trim().min(1).optional(),
  pinterestBoardId: z.string().trim().optional()
});

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

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
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      schedule: true,
      steps: true
    }
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

  if (data.pinterestConnectionName !== undefined || data.pinterestBoardId !== undefined) {
    const existingPublishStep = flow.steps.find((step) => step.type === "pinterest_publish");
    const existingConfig = (existingPublishStep?.configJson ?? {}) as Record<string, unknown>;
    const nextConfig = {
      ...existingConfig,
      connection_name: data.pinterestConnectionName ?? String(existingConfig.connection_name ?? "Main Pinterest"),
      board_id: data.pinterestBoardId ?? String(existingConfig.board_id ?? "")
    };

    if (existingPublishStep) {
      await prisma.flowStep.update({
        where: { id: existingPublishStep.id },
        data: {
          configJson: nextConfig
        }
      });
    } else {
      const maxOrderIndex = flow.steps.reduce((max, step) => Math.max(max, step.orderIndex), 0);
      await prisma.flowStep.create({
        data: {
          flowId: flow.id,
          orderIndex: maxOrderIndex + 1,
          type: "pinterest_publish",
          configJson: {
            connection_name: data.pinterestConnectionName ?? "Main Pinterest",
            board_id: data.pinterestBoardId ?? "",
            title_from: "context.text.title",
            description_from: "context.text.description",
            image_url_from: "context.image.image_url",
            link_url_from: "context.queue.link_url",
            alt_text_template: "{topic}"
          }
        }
      });
    }
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

export async function DELETE(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    select: { id: true }
  });

  if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });

  await prisma.flow.delete({
    where: { id: flow.id }
  });

  return NextResponse.json({ deleted: true });
}

