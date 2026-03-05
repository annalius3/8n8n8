import { QueueStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateContentForQueueItems, publishQueueItems } from "@/lib/campaigns/service";
import { computeNextRunAt } from "@/lib/worker/cron";
import { runFlowNow } from "@/lib/worker/runner";

function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function canRunToday(flowId: string, timezone: string, maxRunsPerDay: number) {
  if (!Number.isFinite(maxRunsPerDay) || maxRunsPerDay <= 0) return true;

  const since = new Date(Date.now() - 1000 * 60 * 60 * 72);
  const runs = await prisma.jobRun.findMany({
    where: {
      flowId,
      startedAt: { gte: since }
    },
    select: { startedAt: true }
  });

  const today = dayKey(new Date(), timezone);
  const count = runs.filter((run) => dayKey(run.startedAt, timezone) === today).length;
  return count < maxRunsPerDay;
}

export async function runSchedulerTick() {
  const now = new Date();
  const due = await prisma.flowSchedule.findMany({
    where: {
      isPaused: false,
      nextRunAt: {
        lte: now
      },
      flow: {
        isEnabled: true
      }
    },
    include: {
      flow: {
        include: {
          steps: {
            select: {
              type: true
            }
          }
        }
      }
    },
    orderBy: {
      nextRunAt: "asc"
    }
  });

  let started = 0;

  for (const schedule of due) {
    await prisma.flowSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        nextRunAt: computeNextRunAt(schedule.cron, schedule.timezone, now)
      }
    });

    const allowed = await canRunToday(schedule.flowId, schedule.timezone, schedule.maxRunsPerDay);
    if (!allowed) {
      continue;
    }

    const hasLegacySourceStep = schedule.flow.steps.some((step) => step.type === "rss" || step.type === "queue");
    if (hasLegacySourceStep) {
      await runFlowNow(schedule.flowId);
      started += 1;
    }
  }

  const dueCampaigns = await prisma.flow.findMany({
    where: {
      isEnabled: true,
      autopublishEnabled: true,
      queueItems: {
        some: {
          status: { in: [QueueStatus.pending, QueueStatus.failed, QueueStatus.ready] },
          publishedAt: null,
          scheduledAt: { lte: now }
        }
      }
    },
    select: {
      id: true,
      userId: true
    }
  });

  let generatedRuns = 0;
  let publishedRuns = 0;
  for (const campaign of dueCampaigns) {
    const duePending = await prisma.postQueueItem.findMany({
      where: {
        flowId: campaign.id,
        userId: campaign.userId,
        status: { in: [QueueStatus.pending, QueueStatus.failed] },
        publishedAt: null,
        scheduledAt: { lte: now }
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 10,
      select: { id: true }
    });

    if (duePending.length > 0) {
      const generated = await generateContentForQueueItems(
        campaign.id,
        campaign.userId,
        duePending.map((item) => item.id)
      );
      generatedRuns += generated.processed;
    }

    const result = await publishQueueItems({
      flowId: campaign.id,
      userId: campaign.userId,
      dueOnly: true
    });
    publishedRuns += result.processed;
  }

  return {
    checkedAt: now.toISOString(),
    started,
    due: due.length,
    generatedRuns,
    publishedRuns
  };
}
