import { Prisma, QueueStatus, RunStatus, StepExecStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateTopicSuggestions, generateQueueItemContent } from "@/lib/campaigns/openai";
import { computeScheduledDates, computeScheduledDatesFromIntervalCron } from "@/lib/campaigns/schedule";
import { deleteLeonardoGeneration, generateLeonardoImage } from "@/lib/integrations/leonardo";
import { publishToPinterest } from "@/lib/integrations/pinterest";
import { applyTemplate } from "@/lib/worker/template";

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

function getStepConfig(flow: FlowWithSteps, type: string) {
  return (flow.steps.find((step) => step.type === type)?.configJson ?? {}) as Record<string, any>;
}

export async function createCampaign(userId: string, input: CampaignInput) {
  return prisma.flow.create({
    data: {
      userId,
      name: input.name?.trim() || input.seedTopic.trim(),
      seedTopic: input.seedTopic.trim(),
      language: input.language,
      niche: input.niche?.trim() || null,
      audience: input.audience?.trim() || null,
      tone: input.tone?.trim() || null,
      postsPerDay: Math.max(1, Math.min(50, input.postsPerDay ?? 3)),
      timezone: input.timezone?.trim() || "Europe/Kiev",
      startTime: input.startTime?.trim() || "09:00",
      autopublishEnabled: Boolean(input.autopublishEnabled),
      isEnabled: true,
      schedule: {
        create: {
          cron: "0 0 * * *",
          timezone: input.timezone?.trim() || "Europe/Kiev",
          maxRunsPerDay: Math.max(1, Math.min(50, input.postsPerDay ?? 3)),
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
              prompt_template:
                "Pinterest-style lifestyle image about {topic}. Context: {description}. 1024x1024, realistic, high quality.",
              negative_prompt: "text, watermark, logo, blurry, low quality",
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
              connection_name: "Основной Pinterest",
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
        status: QueueStatus.pending
      }))
    });
  }

  await planScheduleForFlow(flow.id, userId);

  return { created: uniqueSuggestions.length };
}

export async function planScheduleForFlow(flowId: string, userId: string) {
  const flow = await getFlowOrThrow(flowId, userId);
  const run = await createRun(flow.id);

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
      computeScheduledDatesFromIntervalCron({
        count: pendingItems.length,
        cron: flow.schedule?.cron ?? "",
        timezone: flow.schedule?.timezone ?? flow.timezone
      }) ??
      computeScheduledDates({
        count: pendingItems.length,
        postsPerDay: flow.postsPerDay,
        timezone: flow.timezone,
        startTime: flow.startTime
      });

    for (let index = 0; index < pendingItems.length; index += 1) {
      await prisma.postQueueItem.update({
        where: { id: pendingItems[index].id },
        data: { scheduledAt: scheduledDates[index] }
      });
    }

    await createRunStep({
      runId: run.id,
      stepIndex: 0,
      stepType: "schedule_planning",
      status: StepExecStatus.success,
      inputJson: {
        posts_per_day: flow.postsPerDay,
        timezone: flow.timezone,
        start_time: flow.startTime
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

      const prompt = applyTemplate(
        imageConfig.prompt_template ?? "Pinterest-style lifestyle image about {topic}. Context: {description}.",
        {
          topic: item.topicText ?? item.title,
          title: text.title,
          description: text.description
        }
      );

      const image = await generateLeonardoImage(prompt, {
        userId,
        negativePrompt: imageConfig.negative_prompt ?? "text, watermark, logo, blurry, low quality",
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
        linkUrl: item.linkUrl ?? undefined,
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

      let cleanupError: string | null = null;
      if (item.imageGenerationId) {
        try {
          await deleteLeonardoGeneration(item.imageGenerationId, input.userId);
          await createRunStep({
            runId: run.id,
            stepIndex: 1,
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
            stepIndex: 1,
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

  return { processed: limitedItems.length };
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
    take: 3,
    select: { id: true }
  });

  const queueItemIds = candidates.map((item) => item.id);
  const generationResult = await generateContentForQueueItems(flow.id, userId, queueItemIds);
  const publishResult = await publishQueueItems({
    flowId: flow.id,
    userId,
    queueItemIds,
    limit: 1
  });

  return {
    generated: generationResult.processed,
    published: publishResult.processed
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

