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
  cron: z.string().min(5).optional(),
  timezone: z.string().optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
  isPaused: z.boolean().optional()
});

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } }
    }
  });

  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    include: { schedule: true }
  });
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;

  await prisma.flow.update({
    where: { id: flow.id },
    data: {
      name: data.name,
      isEnabled: data.isEnabled
    }
  });

  if (flow.schedule && (data.cron || data.timezone || data.maxRunsPerDay || data.isPaused !== undefined)) {
    const cron = data.cron ?? flow.schedule.cron;
    const timezone = data.timezone ?? flow.schedule.timezone;

    await prisma.flowSchedule.update({
      where: { flowId: flow.id },
      data: {
        cron,
        timezone,
        maxRunsPerDay: data.maxRunsPerDay,
        isPaused: data.isPaused,
        nextRunAt: computeNextRunAt(cron, timezone)
      }
    });
  }

  if (data.cron || data.timezone || data.maxRunsPerDay) {
    const scheduleStep = await prisma.flowStep.findFirst({
      where: { flowId: flow.id, type: { in: ["schedule", "schedule_trigger"] } },
      orderBy: { orderIndex: "asc" }
    });

    if (scheduleStep) {
      const currentConfig = (scheduleStep.configJson ?? {}) as Record<string, unknown>;
      await prisma.flowStep.update({
        where: { id: scheduleStep.id },
        data: {
          configJson: {
            ...currentConfig,
            ...(data.cron ? { cron: data.cron } : {}),
            ...(data.timezone ? { timezone: data.timezone } : {}),
            ...(data.maxRunsPerDay ? { max_runs_per_day: data.maxRunsPerDay } : {})
          }
        }
      });
    }
  }

  const updated = await prisma.flow.findUnique({
    where: { id: flow.id },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } }
    }
  });

  return NextResponse.json(updated);
}
