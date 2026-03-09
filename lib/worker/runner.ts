import { QueueStatus, RunStatus, StepExecStatus } from "@prisma/client";
import { getServerEnv } from "@/lib/env";
import { buildLeonardoPrompt, getDefaultNegativePrompt } from "@/lib/images/prompt-builder";
import { prisma } from "@/lib/prisma";
import { generateLeonardoImage } from "@/lib/integrations/leonardo";
import { publishToPinterest } from "@/lib/integrations/pinterest";
import { getIntegrationModes } from "@/lib/integrations/runtime";
import { uploadToR2 } from "@/lib/storage/r2";
import { fetchRssItems } from "@/lib/worker/rss";
import { applyTemplate } from "@/lib/worker/template";
import type { RunnerContext } from "@/lib/worker/types";
import { normalizeStepType } from "@/lib/worker/step-schemas";

type StepConfig = Record<string, any>;
type Condition = { op?: "exists"; path?: string };

type SourceItem = {
  type: "rss" | "queue";
  uid: string;
  title?: string;
  summary?: string;
  link_url?: string;
  image_prompt?: string;
  queue_item_id?: string;
};

type TextItem = {
  pin_title: string;
  pin_description: string;
  hashtags: string[];
};

type ImageItem = {
  prompt: string;
  image_url: string;
};

type TextContext = TextItem & {
  provider_mode: "real" | "template";
};

type ImageContext = ImageItem & {
  provider_mode: "real";
};

type PublishContext = {
  platform: "pinterest";
  board_id?: string;
  post_id: string;
  source_uid?: string;
  mode: "real";
};

async function logRunStep(input: {
  jobRunId: string;
  stepIndex: number;
  stepType: string;
  inputJson?: object;
  outputJson?: object;
  status: StepExecStatus;
  error?: string;
}) {
  await prisma.jobRunStep.create({
    data: {
      jobRunId: input.jobRunId,
      stepIndex: input.stepIndex,
      stepType: input.stepType,
      inputJson: input.inputJson,
      outputJson: input.outputJson,
      status: input.status,
      error: input.error,
      finishedAt: new Date()
    }
  });
}

function readPath(obj: Record<string, any>, path: string | undefined): any {
  if (!path) return undefined;
  const clean = path.startsWith("context.") ? path.slice(8) : path;
  return clean.split(".").reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function checkDailyLimit(flowId: string, timezone: string, maxRunsPerDay: number) {
  if (!Number.isFinite(maxRunsPerDay) || maxRunsPerDay <= 0) return;

  const since = new Date(Date.now() - 1000 * 60 * 60 * 72);
  const runs = await prisma.jobRun.findMany({
    where: {
      flowId,
      status: { in: [RunStatus.running, RunStatus.success] },
      startedAt: { gte: since }
    },
    select: { startedAt: true }
  });

  const today = dayKey(new Date(), timezone);
  const todayCount = runs.filter((run) => dayKey(run.startedAt, timezone) === today).length;

  if (todayCount >= maxRunsPerDay) {
    throw new Error(`Daily run limit reached (${maxRunsPerDay})`);
  }
}

function evaluateCondition(condition: Condition | undefined, context: Record<string, any>) {
  if (!condition) return true;
  if (condition.op === "exists") {
    const value = readPath({ context }, condition.path);
    return value !== undefined && value !== null && value !== "";
  }
  return true;
}

function mapField(mapping: Record<string, string> | undefined, key: string, raw: Record<string, any>, fallbackKey: string) {
  const sourceKey = mapping?.[key] ?? fallbackKey;
  return raw[sourceKey];
}

function parseJsonFromModel(text: string): Record<string, any> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const payload = fenced ?? text;
  return JSON.parse(payload);
}

async function generateTextViaOpenAI(
  config: StepConfig,
  vars: Record<string, string>
): Promise<{ pin_title: string; pin_description: string; hashtags: string[]; _mode: "real" }> {
  const mode = getIntegrationModes().openai;
  const apiKey = mode === "real" ? getServerEnv().OPENAI_API_KEY : undefined;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model ?? "gpt-4.1-mini",
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 350,
      messages: [
        { role: "system", content: config.system_prompt ?? "You write Pinterest pin copy." },
        { role: "user", content: applyTemplate(config.user_prompt_template ?? "", vars) }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI call failed: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response is empty");
  }

  const parsed = parseJsonFromModel(content);
  return {
    pin_title: String(parsed.pin_title ?? ""),
    pin_description: String(parsed.pin_description ?? ""),
    hashtags: flattenHashtags(parsed.hashtags),
    _mode: "real"
  };
}

async function lockQueueItem(userId: string, statuses: QueueStatus[], lockCutoff: Date) {
  const candidate = await prisma.postQueueItem.findFirst({
    where: {
      userId,
      status: { in: statuses },
      OR: [{ lockedAt: null }, { lockedAt: { lte: lockCutoff } }]
    },
    orderBy: { createdAt: "asc" }
  });

  if (!candidate) return null;

  const locked = await prisma.postQueueItem.updateMany({
    where: {
      id: candidate.id,
      status: { in: statuses },
      OR: [{ lockedAt: null }, { lockedAt: { lte: lockCutoff } }]
    },
    data: {
      status: QueueStatus.processing,
      lockedAt: new Date()
    }
  });

  if (locked.count !== 1) return null;
  return prisma.postQueueItem.findUnique({ where: { id: candidate.id } });
}

function flattenHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item)).filter((s) => s.length > 0);
}

function renderStoragePath(pathTemplate: string, flowId: string, uid: string) {
  const date = new Date().toISOString().slice(0, 10);
  return pathTemplate.replaceAll("{date}", date).replaceAll("{flow_id}", flowId).replaceAll("{uid}", uid);
}

export async function runFlowNow(flowId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
      schedule: true
    }
  });

  if (!flow) throw new Error("Flow not found");

  const timezone = flow.schedule?.timezone ?? "Europe/Kiev";
  const maxRunsPerDay = flow.schedule?.maxRunsPerDay ?? 10;
  await checkDailyLimit(flow.id, timezone, maxRunsPerDay);

  const run = await prisma.jobRun.create({
    data: {
      flowId: flow.id,
      status: RunStatus.running
    }
  });

  const context = {} as RunnerContext & {
    source_items?: SourceItem[];
    text_items?: TextItem[];
    image_items?: ImageItem[];
    publish_items?: Array<{ platform: "pinterest"; board_id?: string; post_id: string; source_uid: string }>;
    text?: TextContext;
    image?: ImageContext;
    publish?: PublishContext;
    runtime?: ReturnType<typeof getIntegrationModes>;
  };
  context.runtime = getIntegrationModes();

  let currentStepIndex = -1;
  let currentStepType = "unknown";

  try {
    for (let index = 0; index < flow.steps.length; index += 1) {
      const step = flow.steps[index];
      currentStepIndex = index;
      currentStepType = step.type;

      const normalizedType = normalizeStepType(step.type);
      const config = (step.configJson ?? {}) as StepConfig;

      const condition = config.condition as Condition | undefined;
      if (!evaluateCondition(condition, context as Record<string, any>)) {
        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: { condition },
          outputJson: { skipped: true, on_false: config.on_false ?? null },
          status: StepExecStatus.skipped
        });

        if (config.on_false === "stop") break;
        continue;
      }

      if (normalizedType === "schedule") {
        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: {
            cron: config.cron ?? flow.schedule?.cron ?? "",
            timezone: config.timezone ?? timezone,
            max_runs_per_day: config.max_runs_per_day ?? maxRunsPerDay
          },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "delay") {
        const ms = Math.max(0, Number(config.ms ?? 0));
        if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: { waited_ms: ms },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "rss") {
        const rssUrl = config.rss_url;
        if (!rssUrl) throw new Error("rss step requires rss_url");

        const take = Math.max(1, Number(config.take ?? 1));
        const dedupeEnabled = config.dedupe?.enabled !== false;
        const dedupePlatform = config.dedupe?.platform ?? "pinterest";
        const mapping = (config.mapping ?? {}) as Record<string, string>;

        const items = await fetchRssItems(rssUrl);
        const picked: SourceItem[] = [];

        for (const item of items) {
          const raw = {
            uid: item.uid,
            guid_or_link: item.uid,
            title: item.title,
            contentSnippet: item.body,
            summary: item.body,
            link: item.linkUrl,
            link_url: item.linkUrl
          };

          const sourceUid = String(raw.uid);

          if (dedupeEnabled) {
            const exists = await prisma.publishedItem.findFirst({
              where: {
                sourceType: "rss",
                sourceUid,
                platform: dedupePlatform
              }
            });
            if (exists) continue;
          }

          picked.push({
            type: "rss",
            uid: sourceUid,
            title: mapField(mapping, "title", raw, "title"),
            summary: mapField(mapping, "summary", raw, "summary"),
            link_url: mapField(mapping, "link_url", raw, "link_url")
          });

          if (picked.length >= take) break;
        }

        if (picked.length === 0) {
          throw new Error("No new RSS items to publish");
        }

        context.source_items = picked;
        context.source = picked[0];

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: { count: picked.length, first: picked[0] },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "queue") {
        const take = Math.max(1, Number(config.take ?? 1));
        const lockTtlMinutes = Math.max(1, Number(config.lock_ttl_minutes ?? 30));
        const lockCutoff = new Date(Date.now() - lockTtlMinutes * 60_000);
        const statuses = (Array.isArray(config.only_status) && config.only_status.length > 0 ? config.only_status : ["pending"])
          .filter((s: string) => Object.values(QueueStatus).includes(s as QueueStatus)) as QueueStatus[];
        const mapping = (config.mapping ?? {}) as Record<string, string>;

        const picked: SourceItem[] = [];

        for (let i = 0; i < take; i += 1) {
          const item = await lockQueueItem(flow.userId, statuses.length > 0 ? statuses : [QueueStatus.pending], lockCutoff);
          if (!item) break;

          const raw = {
            id: item.id,
            uid: item.id,
            title: item.title,
            body: item.body,
            summary: item.body,
            link_url: item.linkUrl,
            image_prompt: item.imagePrompt
          };

          picked.push({
            type: "queue",
            uid: String(mapField(mapping, "uid", raw, "uid")),
            title: mapField(mapping, "title", raw, "title"),
            summary: mapField(mapping, "summary", raw, "summary"),
            link_url: mapField(mapping, "link_url", raw, "link_url"),
            image_prompt: mapField(mapping, "image_prompt", raw, "image_prompt"),
            queue_item_id: item.id
          });
        }

        if (picked.length === 0) {
          throw new Error("Queue is empty");
        }

        context.source_items = picked;
        context.source = picked[0];

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: { count: picked.length, first: picked[0] },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "template") {
        const sources: SourceItem[] = context.source_items?.length
          ? context.source_items
          : context.source
            ? [context.source as SourceItem]
            : [];
        if (sources.length === 0) throw new Error("template step requires source");

        const textItems: TextItem[] = [];

        for (const source of sources) {
          const vars = {
            title: source.title ?? "",
            summary: source.summary ?? "",
            link_url: source.link_url ?? "",
            hashtags: flattenHashtags(config.hashtags).join(" ")
          };

          let pinTitle = "";
          let pinDescription = "";
          let hashtags = flattenHashtags(config.hashtags);
          let providerMode: "real" | "template" = "template";

          if (config.provider === "openai") {
            const ai = await generateTextViaOpenAI(config, vars);
            pinTitle = String(ai.pin_title ?? "");
            pinDescription = String(ai.pin_description ?? "");
            const aiTags = flattenHashtags(ai.hashtags);
            if (aiTags.length > 0) hashtags = aiTags;
            providerMode = "real";
          }

          if (!pinTitle) pinTitle = applyTemplate(config.pin_title_template ?? "{title}", vars);
          if (!pinDescription) {
            pinDescription = applyTemplate(config.pin_description_template ?? "{summary}\n\n{link_url}", {
              ...vars,
              hashtags: hashtags.join(" ")
            });
          }

          const maxTitleLen = Math.max(1, Number(config.max_title_len ?? 100));
          const maxDescLen = Math.max(1, Number(config.max_desc_len ?? 500));

          textItems.push({
            pin_title: pinTitle.slice(0, maxTitleLen),
            pin_description: pinDescription.slice(0, maxDescLen),
            hashtags
          });

          context.text = {
            pin_title: pinTitle.slice(0, maxTitleLen),
            pin_description: pinDescription.slice(0, maxDescLen),
            hashtags,
            provider_mode: providerMode
          };
        }

        context.text_items = textItems;
        context.text = {
          ...textItems[0],
          provider_mode: config.provider === "openai" ? context.text?.provider_mode ?? "real" : "template"
        };

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: {
            count: textItems.length,
            first: textItems[0],
            provider: config.provider ?? "template",
            mode: config.provider === "openai" ? context.text.provider_mode : "template"
          },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "ai_image_leonardo") {
        const sources: SourceItem[] = context.source_items?.length
          ? context.source_items
          : context.source
            ? [context.source as SourceItem]
            : [];
        if (sources.length === 0) throw new Error("ai_image_leonardo requires source");

        const imageItems: ImageItem[] = [];

        for (const source of sources) {
          const builtPrompt = buildLeonardoPrompt({
            topic: context.text?.pin_title || source.title || source.summary || source.uid,
            title: source.title ?? context.text?.pin_title ?? "",
            description: context.text?.pin_description ?? source.summary ?? "",
            imagePrompt: source.image_prompt ?? "",
            promptTemplate: typeof config.prompt_template === "string" ? config.prompt_template : undefined
          });
          const prompt = builtPrompt.prompt;
          const result = await generateLeonardoImage(prompt, {
            negativePrompt:
              typeof config.negative_prompt === "string" && config.negative_prompt.trim()
                ? config.negative_prompt
                : builtPrompt.negativePrompt ?? getDefaultNegativePrompt(),
            width: Number(config.width ?? 1024),
            height: Number(config.height ?? 1024),
            steps: Number(config.steps ?? 30),
            guidanceScale: Number(config.guidance_scale ?? 7),
            numImages: Number(config.num_images ?? 1),
            timeoutSeconds: Number(config.timeout_seconds ?? 120)
          });

          let imageUrl = result.imageUrl;

          if (config.store?.enabled && config.store?.provider === "cloudflare_r2") {
            const objectPath = renderStoragePath(
              config.store.path_template ?? "leonardo/{date}/{flow_id}/{uid}.jpg",
              flow.id,
              source.uid
            );
            imageUrl = await uploadToR2({ imageUrl: result.imageUrl, objectPath });
          }

          imageItems.push({ prompt, image_url: imageUrl });
          context.image = { prompt, image_url: imageUrl, provider_mode: result.mode };
        }

        context.image_items = imageItems;
        context.image = {
          ...imageItems[0],
          provider_mode: context.image?.provider_mode ?? "real"
        };

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: {
            count: imageItems.length,
            first: imageItems[0],
            mode: context.image.provider_mode
          },
          status: StepExecStatus.success
        });
        continue;
      }

      if (normalizedType === "pinterest_publish") {
        const sources: SourceItem[] = context.source_items?.length
          ? context.source_items
          : context.source
            ? [context.source as SourceItem]
            : [];
        if (sources.length === 0) throw new Error("pinterest_publish requires source");

        const texts = context.text_items ?? [];
        const images = context.image_items ?? [];

        const publishItems: Array<{ platform: "pinterest"; board_id?: string; post_id: string; source_uid: string }> = [];

        for (let i = 0; i < sources.length; i += 1) {
          const source = sources[i];
          const text = texts[i] ?? texts[0] ?? context.text;
          const image = images[i] ?? images[0] ?? context.image;

          const localContext = {
            context: {
              ...context,
              source,
              text,
              image
            }
          };

          const title = readPath(localContext, config.title_from) ?? source.title;
          const description = readPath(localContext, config.description_from) ?? text?.pin_description ?? source.summary;
          if (!title || !description) throw new Error("pinterest_publish requires title and description");

          const linkUrl = readPath(localContext, config.link_url_from) ?? source.link_url;
          const imageUrl = readPath(localContext, config.image_url_from) ?? image?.image_url;

          const altText = applyTemplate(config.alt_text_template ?? "{title}", {
            title: source.title ?? "",
            summary: source.summary ?? "",
            link_url: source.link_url ?? ""
          });

          const publishResult = await publishToPinterest({
            userId: flow.userId,
            connectionName: config.connection_name,
            boardId: config.board_id,
            title: String(title),
            description: String(description),
            linkUrl: linkUrl ? String(linkUrl) : undefined,
            imageUrl: imageUrl ? String(imageUrl) : undefined,
            altText
          });

          const platform = config.dedupe?.platform ?? "pinterest";
          const sourceUid = readPath(localContext, config.dedupe?.source_uid_from) ?? source.uid;

          if (config.dedupe?.write_published_item !== false) {
            await prisma.publishedItem.upsert({
              where: {
                sourceType_sourceUid_platform: {
                  sourceType: source.type,
                  sourceUid: String(sourceUid),
                  platform: String(platform)
                }
              },
              update: { platformPostId: publishResult.postId },
              create: {
                sourceType: source.type,
                sourceUid: String(sourceUid),
                platform: String(platform),
                platformPostId: publishResult.postId
              }
            });
          }

          if (source.queue_item_id) {
            await prisma.postQueueItem.update({
              where: { id: source.queue_item_id },
              data: {
                status: QueueStatus.published,
                publishedAt: new Date(),
                lockedAt: null,
                error: null
              }
            });
          }

          publishItems.push({
            platform: "pinterest",
            board_id: config.board_id,
            post_id: publishResult.postId,
            source_uid: source.uid
          });
          context.publish = {
            platform: "pinterest",
            board_id: config.board_id,
            post_id: publishResult.postId,
            mode: publishResult.mode
          };
        }

        context.publish_items = publishItems;
        context.publish = {
          ...publishItems[0],
          mode: context.publish?.mode ?? "real"
        };

        await logRunStep({
          jobRunId: run.id,
          stepIndex: index,
          stepType: step.type,
          inputJson: config,
          outputJson: {
            count: publishItems.length,
            first: publishItems[0],
            mode: context.publish.mode
          },
          status: StepExecStatus.success
        });
        continue;
      }

      await logRunStep({
        jobRunId: run.id,
        stepIndex: index,
        stepType: step.type,
        status: StepExecStatus.skipped,
        error: `Unknown step type: ${step.type}`
      });
    }

    const queueIdsToUnlock = (context.source_items ?? [])
      .filter((item) => item.type === "queue" && item.queue_item_id)
      .map((item) => item.queue_item_id as string)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);

    if (queueIdsToUnlock.length > 0) {
      await prisma.postQueueItem.updateMany({
        where: {
          id: { in: queueIdsToUnlock },
          status: QueueStatus.processing
        },
        data: {
          status: QueueStatus.pending,
          lockedAt: null
        }
      });
    }

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.success,
        finishedAt: new Date(),
        contextJson: context
      }
    });

    await prisma.flowSchedule.updateMany({
      where: { flowId: flow.id },
      data: { lastRunAt: new Date() }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (currentStepIndex >= 0) {
      await logRunStep({
        jobRunId: run.id,
        stepIndex: currentStepIndex,
        stepType: currentStepType,
        status: StepExecStatus.failed,
        error: message
      });
    }

    const queueIds = (context.source_items ?? [])
      .filter((item) => item.type === "queue" && item.queue_item_id)
      .map((item) => item.queue_item_id as string)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);

    if (queueIds.length > 0) {
      await prisma.postQueueItem.updateMany({
        where: { id: { in: queueIds } },
        data: {
          status: QueueStatus.failed,
          error: message,
          lockedAt: null
        }
      });
    }

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.failed,
        error: message,
        finishedAt: new Date(),
        contextJson: context
      }
    });
  }

  return run.id;
}

