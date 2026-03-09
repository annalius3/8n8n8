import { Prisma, QueueStatus, RunStatus, StepExecStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateTopicSuggestions, generateQueueItemContent } from "@/lib/campaigns/openai";
import {
  computeRandomScheduledDates,
  computeScheduledDates,
  computeScheduledDatesFromIntervalCron,
  computeStartDateFromTime
} from "@/lib/campaigns/schedule";
import { deleteLeonardoGeneration, generateLeonardoImage } from "@/lib/integrations/leonardo";
import { publishToPinterest } from "@/lib/integrations/pinterest";
import { isTelegramConfigured, sendTelegramPublishNotification } from "@/lib/integrations/telegram";
import {
  buildLeonardoPrompt,
  getDefaultLeonardoPromptTemplate,
  getDefaultNegativePrompt
} from "@/lib/images/prompt-builder";
import { applyTemplate } from "@/lib/worker/template";

const DEFAULT_SITE_LINK = "https://www.b2bleadgenerationtools.com/";

type CampaignInput = {
  name?: string;
  seedTopic: string;
  language: "EN" | "RU" | "UA";
  niche?: string | null;
  audience?: string | null;
  tone?: string | null;
  postsPerDay?: number;
  timezone?: string;
  startTime?: string;
  autopublishEnabled?: boolean;
};

type FlowWithSteps = Awaited<ReturnType<typeof getFlowOrThrow>>;

function getCurrentTimeForTimezone(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return formatter.format(new Date());
}

async function createRun(flowId: string, queueItemId?: string | null) {
  return prisma.jobRun.create({
    data: {
      flowId,
      queueItemId: queueItemId ?? undefined,
      status: RunStatus.running
    }
  });
}

async function createRunStep(input: {
  runId: string;
  stepIndex: number;
  stepType: string;
  status: StepExecStatus;
  inputJson?: Prisma.InputJsonValue | null;
  outputJson?: Prisma.InputJsonValue | null;
  error?: string | null;
}) {
  return prisma.jobRunStep.create({
    data: {
      jobRunId: input.runId,
      stepIndex: input.stepIndex,
      stepType: input.stepType,
      status: input.status,
      inputJson: input.inputJson ?? undefined,
      outputJson: input.outputJson ?? undefined,
      error: input.error ?? undefined,
      finishedAt: new Date()
    }
  });
}

async function finishRun(runId: string, input: { status: RunStatus; error?: string | null; contextJson?: Prisma.InputJsonValue }) {
  return prisma.jobRun.update({
    where: { id: runId },
    data: {
      status: input.status,
      error: input.error ?? undefined,
      contextJson: (input.contextJson as Prisma.InputJsonValue | undefined) ?? undefined,
      finishedAt: new Date()
    }
  });
}

export async function getFlowOrThrow(flowId: string, userId: string) {
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, userId },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } },
      topicSuggestions: { orderBy: { createdAt: "asc" } },
      queueItems: { orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }] },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: {
          steps: { orderBy: { stepIndex: "asc" } }
        }
      }
    }
  });

  if (!flow) {
    throw new Error("Campaign not found");
  }

  return flow;
}

export type QueueDiagnostics = {
  checkedAt: string;
  flowEnabled: boolean;
  autopublishEnabled: boolean;
  schedulePaused: boolean;
  scheduleCron: string | null;
  scheduleLastRunAt: string | null;
  scheduleNextRunAt: string | null;
  schedulerStale: boolean;
  dueItemId: string | null;
  dueItemStatus: string | null;
  dueItemScheduledAt: string | null;
  blockedReason: string | null;
  latestPublishError: string | null;
  readyWithImageBufferCount: number;
  prefetchCandidateCount: number;
};

export async function getQueueDiagnostics(flowId: string, userId: string): Promise<QueueDiagnostics> {
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, userId },
    include: {
      schedule: true
    }
  });

  if (!flow) {
    throw new Error("Campaign not found");
  }

  const now = new Date();
  const staleThresholdMs = 1000 * 60 * 75;
  const lastRunAt = flow.schedule?.lastRunAt ?? null;
  const schedulerStale = lastRunAt ? now.getTime() - lastRunAt.getTime() > staleThresholdMs : true;

  const dueItem = await prisma.postQueueItem.findFirst({
    where: {
      flowId: flow.id,
      userId,
      publishedAt: null,
      scheduledAt: { lte: now }
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
  });

  const latestPublishFailure = await prisma.jobRun.findFirst({
    where: {
      flowId: flow.id,
      status: RunStatus.failed,
      steps: {
        some: {
          stepType: "publish",
          status: StepExecStatus.failed
        }
      }
    },
    orderBy: { startedAt: "desc" },
    select: {
      error: true,
      steps: {
        where: {
          stepType: "publish",
          status: StepExecStatus.failed
        },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { error: true }
      }
    }
  });

  const [readyWithImageBufferCount, prefetchCandidateCount] = await Promise.all([
    prisma.postQueueItem.count({
      where: {
        flowId: flow.id,
        userId,
        status: QueueStatus.ready,
        publishedAt: null,
        imageUrl: { not: null }
      }
    }),
    prisma.postQueueItem.count({
      where: {
        flowId: flow.id,
        userId,
        status: { in: [QueueStatus.pending, QueueStatus.failed] },
        publishedAt: null
      }
    })
  ]);

  let blockedReason: string | null = null;
  if (!flow.isEnabled) {
    blockedReason = "Поток выключен";
  } else if (!flow.autopublishEnabled) {
    blockedReason = "Автопубликация выключена в настройках потока";
  } else if (flow.schedule?.isPaused) {
    blockedReason = "Расписание поставлено на паузу";
  } else if (schedulerStale) {
    blockedReason = "Scheduler давно не запускался";
  } else if (!dueItem) {
    blockedReason = null;
  } else if (dueItem.status === QueueStatus.pending) {
    blockedReason = "Элемент ожидает генерацию контента";
  } else if (dueItem.status === QueueStatus.generating) {
    blockedReason = "Элемент сейчас в генерации";
  } else if (dueItem.status === QueueStatus.publishing) {
    blockedReason = "Элемент сейчас публикуется";
  } else if (dueItem.status === QueueStatus.failed) {
    blockedReason = "Последняя попытка завершилась ошибкой, нужен retry";
  } else if (dueItem.status !== QueueStatus.ready) {
    blockedReason = `Элемент в статусе ${dueItem.status}`;
  }

  return {
    checkedAt: now.toISOString(),
    flowEnabled: flow.isEnabled,
    autopublishEnabled: flow.autopublishEnabled,
    schedulePaused: flow.schedule?.isPaused ?? false,
    scheduleCron: flow.schedule?.cron ?? null,
    scheduleLastRunAt: flow.schedule?.lastRunAt?.toISOString() ?? null,
    scheduleNextRunAt: flow.schedule?.nextRunAt?.toISOString() ?? null,
    schedulerStale,
    dueItemId: dueItem?.id ?? null,
    dueItemStatus: dueItem?.status ?? null,
    dueItemScheduledAt: dueItem?.scheduledAt?.toISOString() ?? null,
    blockedReason,
    latestPublishError: latestPublishFailure?.steps[0]?.error ?? latestPublishFailure?.error ?? null,
    readyWithImageBufferCount,
    prefetchCandidateCount
  };
}

export async function ensureDefaultLinkUrlForFlow(flowId: string, userId: string) {
  await prisma.postQueueItem.updateMany({
    where: {
      flowId,
      userId,
      OR: [{ linkUrl: null }, { linkUrl: "" }]
    },
    data: {
      linkUrl: DEFAULT_SITE_LINK
    }
  });
}

function getStepConfig(flow: FlowWithSteps, type: string) {
  return (flow.steps.find((step) => step.type === type)?.configJson ?? {}) as Record<string, any>;
}

export async function createCampaign(userId: string, input: CampaignInput) {
  const timezone = input.timezone?.trim() || "Europe/Kiev";
  const startTime = input.startTime?.trim() || getCurrentTimeForTimezone(timezone);
  const flow = await prisma.flow.create({
    data: {
      userId,
      name: input.name?.trim() || input.seedTopic.trim(),
      seedTopic: input.seedTopic.trim(),
      language: input.language,
      niche: input.niche?.trim() || null,
      audience: input.audience?.trim() || null,
      tone: input.tone?.trim() || null,
      postsPerDay: Math.max(1, Math.min(50, input.postsPerDay ?? 10)),
      timezone,
      startTime,
      autopublishEnabled: input.autopublishEnabled ?? true,
      isEnabled: true,
      schedule: {
        create: {
          cron: "0 0 * * *",
          timezone,
          maxRunsPerDay: Math.max(1, Math.min(50, input.postsPerDay ?? 10)),
          nextRunAt: new Date(),
          isPaused: true
        }
      },
      steps: {
        create: [
          {
            orderIndex: 0,
            type: "template",
            configJson: {
              provider: "openai",
              hashtags: [],
              max_title_len: 90,
              max_desc_len: 450
            }
          },
          {
            orderIndex: 1,
            type: "ai_image_leonardo",
            configJson: {
              prompt_template: getDefaultLeonardoPromptTemplate(),
              negative_prompt: getDefaultNegativePrompt(),
              width: 1024,
              height: 1024,
              steps: 30,
              guidance_scale: 7,
              num_images: 1,
              timeout_seconds: 120
            }
          },
          {
            orderIndex: 2,
            type: "pinterest_publish",
            configJson: {
              connection_name: "Main Pinterest",
              board_id: "",
              title_from: "context.text.title",
              description_from: "context.text.description",
              image_url_from: "context.image.image_url",
              link_url_from: "context.queue.link_url",
              alt_text_template: "{topic}"
            }
          }
        ]
      }
    }
  });

  return flow;
}

export async function generateTopicsForCampaign(flowId: string, userId: string) {
  const flow = await getFlowOrThrow(flowId, userId);
  const run = await createRun(flow.id);

  try {
    const inputJson = {
      seed_topic: flow.seedTopic,
      language: flow.language,
      niche: flow.niche,
      audience: flow.audience,
      tone: flow.tone
    };

    const topics = await generateTopicSuggestions({
      seedTopic: flow.seedTopic ?? flow.name,
      language: flow.language as "EN" | "RU" | "UA",
      niche: flow.niche,
      audience: flow.audience,
      tone: flow.tone
    });

    await prisma.topicSuggestion.deleteMany({ where: { flowId: flow.id } });
    await prisma.topicSuggestion.createMany({
      data: topics.map((topicText) => ({
        flowId: flow.id,
        topicText
      }))
    });

    await createRunStep({
      runId: run.id,
      stepIndex: 0,
      stepType: "topic_generation",
      status: StepExecStatus.success,
      inputJson,
      outputJson: { count: topics.length, topics }
    });

    await finishRun(run.id, {
      status: RunStatus.success,
      contextJson: { topics_count: topics.length }
    });

    return {
      flowId: flow.id,
      runId: run.id
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Topic generation failed";
    await createRunStep({
      runId: run.id,
      stepIndex: 0,
      stepType: "topic_generation",
      status: StepExecStatus.failed,
      error: message
    });
    await finishRun(run.id, { status: RunStatus.failed, error: message });
    throw error;
  }
}

export async function addTopicsToQueue(flowId: string, userId: string, topicIds: string[]) {
  const flow = await getFlowOrThrow(flowId, userId);
  const suggestions = await prisma.topicSuggestion.findMany({
    where: {
      flowId: flow.id,
      id: { in: topicIds },
      selected: false
    },
    orderBy: { createdAt: "asc" }
  });

  if (suggestions.length === 0) {
    return { created: 0 };
  }

  const existingQueueTopics = new Set(
    (
      await prisma.postQueueItem.findMany({
        where: {
          flowId: flow.id,
          userId,
          topicText: { in: suggestions.map((item) => item.topicText) }
        },
        select: { topicText: true }
      })
    )
      .map((item) => item.topicText)
      .filter((item): item is string => Boolean(item))
  );

  const uniqueSuggestions = suggestions.filter((item) => !existingQueueTopics.has(item.topicText));

  await prisma.topicSuggestion.updateMany({
    where: { id: { in: suggestions.map((item) => item.id) } },
    data: { selected: true }
  });

  if (uniqueSuggestions.length > 0) {
    await prisma.postQueueItem.createMany({
      data: uniqueSuggestions.map((suggestion) => ({
        userId,
        flowId: flow.id,
        topicText: suggestion.topicText,
        title: suggestion.topicText,
        body: "",
        linkUrl: DEFAULT_SITE_LINK,
        status: QueueStatus.pending
      }))
    });
  }

  await planScheduleForFlow(flow.id, userId);

  return { created: uniqueSuggestions.length };
}

type PlanScheduleMode = "default" | "hourly" | "interval_hours" | "random_daily";

type PlanScheduleOptions = {
  mode?: PlanScheduleMode;
  intervalHours?: number;
  startTime?: string;
  timezone?: string;
};

export async function planScheduleForFlow(flowId: string, userId: string, options?: PlanScheduleOptions) {
  const flow = await getFlowOrThrow(flowId, userId);
  const run = await createRun(flow.id);
  const mode = options?.mode ?? "default";
  const timezone = options?.timezone?.trim() || flow.timezone;
  const startTime = options?.startTime?.trim() || flow.startTime;
  const safeIntervalHours = Math.max(1, Math.min(24, Math.floor(options?.intervalHours ?? 1)));

  try {
    const pendingItems = await prisma.postQueueItem.findMany({
      where: {
        flowId: flow.id,
        status: { in: [QueueStatus.pending, QueueStatus.ready] },
        publishedAt: null
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
    });

    const scheduledDates =
      mode === "hourly"
        ? Array.from({ length: pendingItems.length }, (_, index) => {
            const base = new Date();
            base.setSeconds(0, 0);
            base.setMinutes(0);
            base.setHours(base.getHours() + index + 1);
            return base;
          })
        : mode === "interval_hours"
          ? (() => {
              let first = computeStartDateFromTime({
                startTime,
                timezone
              });
              const now = new Date();
              if (first.getTime() - now.getTime() > safeIntervalHours * 60 * 60 * 1000) {
                first = new Date(now.getTime() + 60 * 1000);
                first.setSeconds(0, 0);
              }
              return Array.from({ length: pendingItems.length }, (_, index) => {
                const date = new Date(first);
                date.setHours(date.getHours() + safeIntervalHours * index);
                return date;
              });
            })()
          : mode === "random_daily"
            ? computeRandomScheduledDates({
                count: pendingItems.length,
                postsPerDay: flow.postsPerDay,
                timezone,
                startTime
              })
            : (flow.schedule?.cron === "random_daily"
                ? computeRandomScheduledDates({
                    count: pendingItems.length,
                    postsPerDay: flow.postsPerDay,
                    timezone,
                    startTime
                  })
                : null) ??
              computeScheduledDatesFromIntervalCron({
                count: pendingItems.length,
                cron: flow.schedule?.cron ?? "",
                timezone
              }) ??
              computeScheduledDates({
                count: pendingItems.length,
                postsPerDay: flow.postsPerDay,
                timezone,
                startTime
              });

    for (let index = 0; index < pendingItems.length; index += 1) {
      await prisma.postQueueItem.update({
        where: { id: pendingItems[index].id },
        data: { scheduledAt: scheduledDates[index] }
      });
    }

    if (mode === "hourly" || mode === "interval_hours" || mode === "random_daily") {
      await prisma.flow.update({
        where: { id: flow.id },
        data: {
          timezone,
          startTime,
          isEnabled: true,
          autopublishEnabled: true
        }
      });

      if (flow.schedule) {
        await prisma.flowSchedule.update({
          where: { flowId: flow.id },
          data: {
            cron: mode === "random_daily" ? "random_daily" : `${startTime.split(":")[1] ?? "0"} */${mode === "hourly" ? 1 : safeIntervalHours} * * *`,
            isPaused: false,
            timezone,
            nextRunAt: scheduledDates[0] ?? new Date()
          }
        });
      }
    }

    await createRunStep({
      runId: run.id,
      stepIndex: 0,
      stepType: "schedule_planning",
      status: StepExecStatus.success,
      inputJson: {
        mode,
        interval_hours: mode === "interval_hours" ? safeIntervalHours : undefined,
        posts_per_day: flow.postsPerDay,
        timezone,
        start_time: startTime
      },
      outputJson: {
        count: pendingItems.length,
        scheduled_at: scheduledDates.map((date) => date.toISOString())
      }
    });

    await finishRun(run.id, {
      status: RunStatus.success,
      contextJson: { scheduled_count: pendingItems.length }
    });

    return { count: pendingItems.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schedule planning failed";
    await createRunStep({
      runId: run.id,
      stepIndex: 0,
      stepType: "schedule_planning",
      status: StepExecStatus.failed,
      error: message
    });
    await finishRun(run.id, { status: RunStatus.failed, error: message });
    throw error;
  }
}

export async function generateContentForQueueItems(flowId: string, userId: string, queueItemIds: string[]) {
  const flow = await getFlowOrThrow(flowId, userId);
  const imageConfig = getStepConfig(flow, "ai_image_leonardo");

  const items = await prisma.postQueueItem.findMany({
    where: {
      flowId: flow.id,
      userId,
      id: { in: queueItemIds }
    },
    orderBy: { createdAt: "asc" }
  });

  let processed = 0;

  for (const item of items) {
    const run = await createRun(flow.id, item.id);

    try {
      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          status: QueueStatus.generating,
          lockedAt: new Date(),
          error: null
        }
      });

      const text = await generateQueueItemContent({
        language: flow.language as "EN" | "RU" | "UA",
        topic: item.topicText ?? item.title,
        niche: flow.niche,
        audience: flow.audience,
        tone: flow.tone
      });

      await createRunStep({
        runId: run.id,
        stepIndex: 0,
        stepType: "text_generation",
        status: StepExecStatus.success,
        inputJson: {
          topic: item.topicText ?? item.title,
          language: flow.language
        },
        outputJson: text
      });

      const builtPrompt = buildLeonardoPrompt({
        topic: item.topicText ?? item.title,
        title: text.title,
        description: text.description,
        imagePrompt: item.imagePrompt ?? undefined,
        promptTemplate: typeof imageConfig.prompt_template === "string" ? imageConfig.prompt_template : undefined
      });
      const prompt = builtPrompt.prompt;

      const image = await generateLeonardoImage(prompt, {
        userId,
        negativePrompt: imageConfig.negative_prompt ?? builtPrompt.negativePrompt,
        width: Number(imageConfig.width ?? 1024),
        height: Number(imageConfig.height ?? 1024),
        steps: Number(imageConfig.steps ?? 30),
        guidanceScale: Number(imageConfig.guidance_scale ?? 7),
        numImages: Number(imageConfig.num_images ?? 1),
        timeoutSeconds: Number(imageConfig.timeout_seconds ?? 120)
      });

      await createRunStep({
        runId: run.id,
        stepIndex: 1,
        stepType: "image_generation",
        status: StepExecStatus.success,
        inputJson: {
          topic: item.topicText ?? item.title,
          prompt
        },
        outputJson: {
          prompt,
          generation_id: image.generationId,
          image_url: image.imageUrl
        }
      });

      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          title: text.title,
          body: text.description,
          linkUrl: item.linkUrl ?? DEFAULT_SITE_LINK,
          imageUrl: image.imageUrl,
          imageGenerationId: image.generationId,
          imagePrompt: prompt,
          status: QueueStatus.ready,
          lockedAt: null,
          error: null
        }
      });

      await finishRun(run.id, {
        status: RunStatus.success,
        contextJson: {
          queue_item_id: item.id,
          topic: item.topicText,
          text,
          image: {
            prompt,
            image_url: image.imageUrl
          }
        }
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content generation failed";
      await createRunStep({
        runId: run.id,
        stepIndex: 99,
        stepType: "generation_failed",
        status: StepExecStatus.failed,
        error: message
      });
      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          status: QueueStatus.failed,
          error: message,
          lockedAt: null
        }
      });
      await finishRun(run.id, { status: RunStatus.failed, error: message });
    }
  }

  return { processed };
}

export async function publishQueueItems(input: {
  flowId: string;
  userId: string;
  queueItemIds?: string[];
  dueOnly?: boolean;
  limit?: number;
}) {
  const flow = await getFlowOrThrow(input.flowId, input.userId);
  const publishConfig = getStepConfig(flow, "pinterest_publish");
  const now = new Date();

  const items = await prisma.postQueueItem.findMany({
    where: {
      flowId: flow.id,
      userId: input.userId,
      ...(input.queueItemIds?.length ? { id: { in: input.queueItemIds } } : {}),
      ...(input.dueOnly ? { scheduledAt: { lte: now } } : {}),
      status: QueueStatus.ready,
      publishedAt: null
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
  });

  const limitedItems = typeof input.limit === "number" ? items.slice(0, Math.max(0, input.limit)) : items;

  let processed = 0;

  for (const item of limitedItems) {
    const run = await createRun(flow.id, item.id);

    try {
      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          status: QueueStatus.publishing,
          lockedAt: new Date(),
          error: null
        }
      });

      const publishResult = await publishToPinterest({
        userId: input.userId,
        connectionName: publishConfig.connection_name,
        boardId: publishConfig.board_id,
        title: item.title,
        description: item.body,
        linkUrl: item.linkUrl ?? DEFAULT_SITE_LINK,
        imageUrl: item.imageUrl ?? undefined,
        altText: applyTemplate(publishConfig.alt_text_template ?? "{topic}", {
          topic: item.topicText ?? item.title,
          title: item.title
        })
      });

      await createRunStep({
        runId: run.id,
        stepIndex: 0,
        stepType: "publish",
        status: StepExecStatus.success,
        inputJson: {
          queue_item_id: item.id,
          board_id: publishConfig.board_id,
          connection_name: publishConfig.connection_name
        },
        outputJson: {
          post_id: publishResult.postId,
          mode: publishResult.mode
        }
      });

      if (isTelegramConfigured()) {
        try {
          await sendTelegramPublishNotification({
            flowName: flow.name,
            title: item.title,
            postId: publishResult.postId,
            linkUrl: item.linkUrl ?? DEFAULT_SITE_LINK
          });

          await createRunStep({
            runId: run.id,
            stepIndex: 1,
            stepType: "telegram_notification",
            status: StepExecStatus.success,
            inputJson: {
              post_id: publishResult.postId,
              flow_name: flow.name
            },
            outputJson: {
              sent: true
            }
          });
        } catch (error) {
          const telegramError = error instanceof Error ? error.message : "Telegram notification failed";
          await createRunStep({
            runId: run.id,
            stepIndex: 1,
            stepType: "telegram_notification",
            status: StepExecStatus.failed,
            error: telegramError
          });
        }
      } else {
        await createRunStep({
          runId: run.id,
          stepIndex: 1,
          stepType: "telegram_notification",
          status: StepExecStatus.skipped,
          error: "Telegram notifications are not configured"
        });
      }

      let cleanupError: string | null = null;
      if (item.imageGenerationId) {
        try {
          await deleteLeonardoGeneration(item.imageGenerationId, input.userId);
          await createRunStep({
            runId: run.id,
            stepIndex: 2,
            stepType: "image_cleanup",
            status: StepExecStatus.success,
            inputJson: {
              generation_id: item.imageGenerationId
            },
            outputJson: {
              deleted: true
            }
          });
        } catch (error) {
          cleanupError = error instanceof Error ? error.message : "Leonardo cleanup failed";
          await createRunStep({
            runId: run.id,
            stepIndex: 2,
            stepType: "image_cleanup",
            status: StepExecStatus.failed,
            error: cleanupError,
            inputJson: {
              generation_id: item.imageGenerationId
            }
          });
        }
      }

      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          status: QueueStatus.published,
          publishedAt: new Date(),
          imageUrl: cleanupError ? item.imageUrl : null,
          imagePrompt: cleanupError ? item.imagePrompt : null,
          imageGenerationId: cleanupError ? item.imageGenerationId : null,
          lockedAt: null,
          error: cleanupError
        }
      });

      await finishRun(run.id, {
        status: RunStatus.success,
        contextJson: {
          queue_item_id: item.id,
          publish: {
            post_id: publishResult.postId,
            mode: publishResult.mode
          },
          cleanup: {
            generation_id: item.imageGenerationId,
            deleted: cleanupError ? false : Boolean(item.imageGenerationId),
            error: cleanupError
          }
        }
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      await createRunStep({
        runId: run.id,
        stepIndex: 0,
        stepType: "publish",
        status: StepExecStatus.failed,
        error: message
      });
      await prisma.postQueueItem.update({
        where: { id: item.id },
        data: {
          status: QueueStatus.failed,
          error: message,
          lockedAt: null
        }
      });
      await finishRun(run.id, { status: RunStatus.failed, error: message });
    }
  }

  return { processed };
}

export async function runGenerateAllPipeline(flowId: string, userId: string) {
  const flow = await getFlowOrThrow(flowId, userId);

  const candidates = await prisma.postQueueItem.findMany({
    where: {
      flowId: flow.id,
      userId,
      publishedAt: null,
      status: { in: [QueueStatus.pending, QueueStatus.failed] }
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: { id: true }
  });

  const queueItemIds = candidates.map((item) => item.id);
  let generated = 0;
  let published = 0;

  for (const queueItemId of queueItemIds) {
    const generationResult = await generateContentForQueueItems(flow.id, userId, [queueItemId]);
    generated += generationResult.processed;

    if (published === 0) {
      const publishResult = await publishQueueItems({
        flowId: flow.id,
        userId,
        queueItemIds: [queueItemId],
        limit: 1
      });
      published += publishResult.processed;
    }
  }

  if (published === 0 && queueItemIds.length > 0) {
    const publishResult = await publishQueueItems({
      flowId: flow.id,
      userId,
      queueItemIds,
      limit: 1
    });
    published += publishResult.processed;
  }

  return {
    generated,
    published
  };
}

export async function retryFailedQueueItems(flowId: string, userId: string, queueItemIds: string[]) {
  const flow = await getFlowOrThrow(flowId, userId);
  const result = await prisma.postQueueItem.updateMany({
    where: {
      flowId: flow.id,
      userId,
      id: { in: queueItemIds },
      status: QueueStatus.failed
    },
    data: {
      status: QueueStatus.pending,
      error: null,
      lockedAt: null
    }
  });

  await planScheduleForFlow(flow.id, userId);
  return { updated: result.count };
}

export async function deleteQueueItems(flowId: string, userId: string, queueItemIds: string[]) {
  const flow = await getFlowOrThrow(flowId, userId);
  const result = await prisma.postQueueItem.deleteMany({
    where: {
      flowId: flow.id,
      userId,
      id: { in: queueItemIds }
    }
  });

  return { deleted: result.count };
}

