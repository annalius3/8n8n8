import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";
import { flowStepsArraySchema } from "@/lib/worker/step-schemas";

type Params = {
  params: Promise<{ id: string }>;
};

const requestSchema = z.object({
  steps: flowStepsArraySchema
});

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.flow.findFirst({ where: { id, userId: user.id } });
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : String(error) }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.flowStep.deleteMany({ where: { flowId: flow.id } }),
    prisma.flowStep.createMany({
      data: parsed.steps.map((step, index) => ({
        flowId: flow.id,
        orderIndex: index,
        type: step.type,
        configJson: step.configJson
      }))
    })
  ]);

  const scheduleStep = parsed.steps.find((step) => step.type === "schedule");
  if (scheduleStep) {
    const cfg = scheduleStep.configJson as { cron: string; timezone: string; max_runs_per_day: number };
    await prisma.flowSchedule.updateMany({
      where: { flowId: flow.id },
      data: {
        cron: cfg.cron,
        timezone: cfg.timezone,
        maxRunsPerDay: cfg.max_runs_per_day
      }
    });
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

