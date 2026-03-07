import {
  AutoPostJobStatus,
  QueueStatus,
  RunStatus,
  SocialPlatform,
  StepExecStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTOPOST_SYSTEM_FLOW_NAME, SOCIAL_PLATFORMS } from "@/lib/autopost/constants";
import { ensureArticleSourceConfig, scanNewArticlesForUser } from "@/lib/autopost/source";
import { generatePlatformContent } from "@/lib/autopost/generation";
import { publishByPlatform } from "@/lib/autopost/publishers";

const ACTIVE_JOB_STATUSES: AutoPostJobStatus[] = ["pending", "generated", "scheduled", "publishing", "published"];

async function ensureSystemFlow(userId: string) {
  const existing = await prisma.flow.findFirst({
    where: {
      userId,
      name: AUTOPOST_SYSTEM_FLOW_NAME
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.flow.create({
    data: {
      userId,
      name: AUTOPOST_SYSTEM_FLOW_NAME,
      seedTopic: "system",
      language: "EN",
      isEnabled: false,
      autopublishEnabled: false,
      postsPerDay: 1
    }
  });
}

async function createRun(userId: string, stepType: string, inputJson?: Record<string, any>) {
  const systemFlow = await ensureSystemFlow(userId);
  const run = await prisma.jobRun.create({
    data: {
      flowId: systemFlow.id,
      status: RunStatus.running
    }
  });

  if (inputJson) {
    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 0,
        stepType,
        status: StepExecStatus.success,
        inputJson,
        finishedAt: new Date()
      }
    });
  }

  return run;
}

async function finishRun(runId: string, status: RunStatus, contextJson?: Record<string, any>, error?: string) {
  await prisma.jobRun.update({
    where: { id: runId },
    data: {
      status,
      error: error ?? null,
      contextJson: contextJson ?? undefined,
      finishedAt: new Date()
    }
  });
}

export async function ensureAutoPostBootstrap(userId: string) {
  await ensureArticleSourceConfig(userId);

  const existing = await prisma.autoPostPlatformSetting.findMany({
    where: { userId },
    select: { platform: true }
  });
  const existingSet = new Set(existing.map((item) => item.platform));

  const missing = SOCIAL_PLATFORMS.filter((platform) => !existingSet.has(platform));
  if (missing.length > 0) {
    await prisma.autoPostPlatformSetting.createMany({
      data: missing.map((platform) => ({
        userId,
        platform,
        enabled: platform === "telegram" || platform === "pinterest",
        maxPostsPerDay: 10,
        minIntervalMinutes: 60,
        requireApproval: platform === "reddit"
      }))
    });
  }
}

async function dayRange(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function computeScheduledAt(userId: string, platform: SocialPlatform, immediate: boolean, maxPostsPerDay: number, minIntervalMinutes: number) {
  const now = new Date();
  const latest = await prisma.autoPostJob.findFirst({
    where: {
      userId,
      platform,
      status: { in: ACTIVE_JOB_STATUSES }
    },
    orderBy: [{ scheduledAt: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }]
  });

  let candidate = immediate ? now : new Date(now.getTime() + 10 * 60_000);
  const latestDate = latest?.scheduledAt ?? latest?.publishedAt;
  if (latestDate) {
    const nextByInterval = new Date(latestDate.getTime() + Math.max(1, minIntervalMinutes) * 60_000);
    if (nextByInterval > candidate) {
      candidate = nextByInterval;
    }
  }

  let guard = 0;
  while (guard < 10) {
    guard += 1;
    const { start, end } = await dayRange(candidate);
    const dailyCount = await prisma.autoPostJob.count({
      where: {
        userId,
        platform,
        status: { in: ACTIVE_JOB_STATUSES },
        scheduledAt: {
          gte: start,
          lt: end
        }
      }
    });

    if (dailyCount < Math.max(1, maxPostsPerDay)) {
      return candidate;
    }

    const nextDay = new Date(start);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(9, 0, 0, 0);
    candidate = nextDay;
  }

  return candidate;
}

async function createOrUpdateJobsForArticle(userId: string, articleId: string, immediatePublishEnabled: boolean) {
  const settings = await prisma.autoPostPlatformSetting.findMany({
    where: {
      userId,
      enabled: true
    }
  });

  for (const setting of settings) {
    const scheduledAt = await computeScheduledAt(
      userId,
      setting.platform,
      immediatePublishEnabled,
      setting.maxPostsPerDay,
      setting.minIntervalMinutes
    );

    await prisma.autoPostJob.upsert({
      where: {
        articleId_platform: {
          articleId,
          platform: setting.platform
        }
      },
      create: {
        userId,
        articleId,
        platform: setting.platform,
        status: AutoPostJobStatus.pending,
        scheduledAt
      },
      update: {
        status: AutoPostJobStatus.pending,
        errorMessage: null,
        scheduledAt
      }
    });
  }
}

export async function scanAndQueueNewArticles(userId: string) {
  await ensureAutoPostBootstrap(userId);
  const sourceConfig = await ensureArticleSourceConfig(userId);
  const run = await createRun(userId, "autopost_scan", {
    source_type: sourceConfig.sourceType,
    rss_url: sourceConfig.rssUrl
  });

  try {
    const scanResult = await scanNewArticlesForUser(userId);
    const freshArticles =
      scanResult.articleIds.length > 0
        ? await prisma.article.findMany({
            where: {
              userId,
              autopostEnabled: true,
              id: { in: scanResult.articleIds }
            }
          })
        : [];

    for (const article of freshArticles) {
      await createOrUpdateJobsForArticle(userId, article.id, sourceConfig.immediatePublishEnabled);
    }

    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_scan_result",
        status: StepExecStatus.success,
        outputJson: {
          scanned: scanResult.scanned,
          created_articles: scanResult.created
        },
        finishedAt: new Date()
      }
    });

    await finishRun(run.id, RunStatus.success, {
      scanned: scanResult.scanned,
      created_articles: scanResult.created
    });

    return scanResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autopost scan failed";
    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_scan_result",
        status: StepExecStatus.failed,
        error: message,
        finishedAt: new Date()
      }
    });
    await finishRun(run.id, RunStatus.failed, undefined, message);
    throw error;
  }
}

export async function generateForArticle(userId: string, articleId: string, forceRegenerate = false) {
  const article = await prisma.article.findFirst({
    where: { id: articleId, userId }
  });
  if (!article) {
    throw new Error("Article not found");
  }

  const run = await createRun(userId, "autopost_generate", { article_id: article.id, force_regenerate: forceRegenerate });
  try {
    const generated = await generatePlatformContent({
      title: article.title,
      canonicalUrl: article.canonicalUrl,
      category: article.category,
      excerpt: article.excerpt,
      content: article.content
    });

    await createOrUpdateJobsForArticle(userId, article.id, false);
    const jobs = await prisma.autoPostJob.findMany({
      where: { articleId: article.id }
    });

    for (const job of jobs) {
      const platformPayload: Record<string, any> =
        job.platform === "twitter"
          ? { variants: generated.twitter, canonicalUrl: article.canonicalUrl }
          : job.platform === "linkedin"
            ? { variants: generated.linkedin, canonicalUrl: article.canonicalUrl }
            : job.platform === "reddit"
              ? { ...generated.reddit, canonicalUrl: article.canonicalUrl }
              : job.platform === "telegram"
                ? generated.telegram
                : job.platform === "pinterest"
                  ? {
                      pinTitle: generated.pinterest.pinTitle,
                      pinDescription: generated.pinterest.pinDescription,
                      imagePrompt: generated.pinterest.imagePrompt,
                      imageUrl: null,
                      canonicalUrl: article.canonicalUrl
                    }
                  : job.platform === "medium"
                    ? { ...(generated.medium ?? {}), canonicalUrl: article.canonicalUrl }
                    : job.platform === "facebook"
                      ? { ...(generated.facebook ?? {}), canonicalUrl: article.canonicalUrl }
                      : {};

      await prisma.autoPostJob.update({
        where: { id: job.id },
        data: {
          generatedContent: platformPayload,
          status: AutoPostJobStatus.generated,
          errorMessage: null
        }
      });

      const shouldWriteAsset = forceRegenerate || job.platform === "pinterest" || job.platform === "linkedin" || job.platform === "twitter";
      if (shouldWriteAsset) {
        await prisma.autoPostAsset.create({
          data: {
            userId,
            articleId: article.id,
            platform: job.platform,
            title:
              job.platform === "pinterest"
                ? generated.pinterest.pinTitle
                : job.platform === "reddit"
                  ? generated.reddit.title
                  : article.title,
            body:
              job.platform === "pinterest"
                ? generated.pinterest.pinDescription
                : job.platform === "reddit"
                  ? generated.reddit.body
                  : JSON.stringify(platformPayload),
            hashtags: generated.general.tags,
            imagePrompt:
              job.platform === "pinterest" ? generated.pinterest.imagePrompt : generated.general.imagePromptHorizontal,
            metadataJson: platformPayload
          }
        });
      }
    }

    await prisma.article.update({
      where: { id: article.id },
      data: {
        assetsGeneratedAt: new Date()
      }
    });

    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_generate_result",
        status: StepExecStatus.success,
        outputJson: {
          article_id: article.id,
          platforms: jobs.map((job) => job.platform),
          tags: generated.general.tags
        },
        finishedAt: new Date()
      }
    });

    await finishRun(run.id, RunStatus.success, {
      article_id: article.id,
      generated: true
    });

    return { generated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autopost generation failed";
    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_generate_result",
        status: StepExecStatus.failed,
        error: message,
        finishedAt: new Date()
      }
    });
    await finishRun(run.id, RunStatus.failed, undefined, message);
    throw error;
  }
}

export async function publishJob(userId: string, jobId: string, options?: { manual?: boolean }) {
  const job = await prisma.autoPostJob.findFirst({
    where: { id: jobId, userId },
    include: { article: true }
  });
  if (!job) {
    throw new Error("Job not found");
  }

  const platformSetting = await prisma.autoPostPlatformSetting.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: job.platform
      }
    }
  });

  if (!platformSetting?.enabled) {
    await prisma.autoPostJob.update({
      where: { id: job.id },
      data: {
        status: AutoPostJobStatus.skipped,
        errorMessage: "[PLATFORM_DISABLED] Platform is disabled in autopost settings"
      }
    });
    return {
      outcome: "skipped",
      code: "PLATFORM_DISABLED",
      reason: "Platform is disabled in autopost settings"
    } as const;
  }

  if (platformSetting.requireApproval && !options?.manual) {
    await prisma.autoPostJob.update({
      where: { id: job.id },
      data: {
        status: AutoPostJobStatus.scheduled,
        errorMessage: "[MANUAL_APPROVAL_REQUIRED] Manual approval is required for this platform"
      }
    });
    return {
      outcome: "skipped",
      code: "MANUAL_APPROVAL_REQUIRED",
      reason: "Manual approval is required for this platform"
    } as const;
  }

  if (!job.generatedContent || Object.keys(job.generatedContent as Record<string, any>).length === 0) {
    throw new Error("Generated content missing. Run generation first.");
  }

  const run = await createRun(userId, "autopost_publish", { job_id: job.id, platform: job.platform });
  await prisma.autoPostJob.update({
    where: { id: job.id },
    data: {
      status: AutoPostJobStatus.publishing,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      errorMessage: null
    }
  });

  try {
    const result = await publishByPlatform(job.platform, {
      userId,
      article: {
        id: job.article.id,
        title: job.article.title,
        canonicalUrl: job.article.canonicalUrl
      },
      content: job.generatedContent as Record<string, any>
    });

    if (result.outcome === "published") {
      await prisma.autoPostJob.update({
        where: { id: job.id },
        data: {
          status: AutoPostJobStatus.published,
          publishedAt: new Date(),
          externalPostId: result.externalPostId,
          errorMessage: null
        }
      });
    } else if (result.outcome === "skipped") {
      await prisma.autoPostJob.update({
        where: { id: job.id },
        data: {
          status: AutoPostJobStatus.skipped,
          errorMessage: `[${result.code}] ${result.reason}`
        }
      });
    } else {
      await prisma.autoPostJob.update({
        where: { id: job.id },
        data: {
          status: AutoPostJobStatus.failed,
          errorMessage: `[${result.code}] ${result.reason}`
        }
      });
    }

    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_publish_result",
        status: result.outcome === "failed" ? StepExecStatus.failed : StepExecStatus.success,
        outputJson: {
          platform: job.platform,
          outcome: result.outcome,
          ...(result.outcome === "published" ? { external_post_id: result.externalPostId } : {}),
          ...(result.outcome !== "published" ? { reason: result.reason, code: result.code } : {})
        },
        error: result.outcome === "failed" ? result.reason : undefined,
        finishedAt: new Date()
      }
    });

    if (result.outcome === "failed") {
      await finishRun(run.id, RunStatus.failed, { job_id: job.id }, result.reason);
    } else {
      await finishRun(run.id, RunStatus.success, { job_id: job.id, outcome: result.outcome });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    await prisma.autoPostJob.update({
      where: { id: job.id },
      data: {
        status: AutoPostJobStatus.failed,
        errorMessage: message
      }
    });
    await prisma.jobRunStep.create({
      data: {
        jobRunId: run.id,
        stepIndex: 1,
        stepType: "autopost_publish_result",
        status: StepExecStatus.failed,
        error: message,
        finishedAt: new Date()
      }
    });
    await finishRun(run.id, RunStatus.failed, { job_id: job.id }, message);
    throw error;
  }
}

export async function publishForArticle(userId: string, articleId: string, platform?: SocialPlatform) {
  const jobs = await prisma.autoPostJob.findMany({
    where: {
      userId,
      articleId,
      ...(platform ? { platform } : {}),
      status: { in: ["generated", "scheduled", "failed", "skipped"] }
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
  });

  let processed = 0;
  for (const job of jobs) {
    await publishJob(userId, job.id, { manual: true });
    processed += 1;
  }

  return { processed };
}

export async function processDueAutoPostJobs() {
  const now = new Date();
  const dueJobs = await prisma.autoPostJob.findMany({
    where: {
      status: { in: ["generated", "scheduled"] },
      scheduledAt: { lte: now }
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 100
  });

  let published = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of dueJobs) {
    try {
      const result = await publishJob(job.userId, job.id, { manual: false });
      if (result.outcome === "published") published += 1;
      if (result.outcome === "failed") failed += 1;
      if (result.outcome === "skipped") skipped += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    due: dueJobs.length,
    published,
    failed,
    skipped
  };
}

export async function getAutoPostStatus(userId: string, articleId: string) {
  const article = await prisma.article.findFirst({
    where: { id: articleId, userId },
    include: {
      jobs: {
        orderBy: { platform: "asc" }
      },
      assets: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!article) {
    throw new Error("Article not found");
  }

  return article;
}

export async function getAutoPostDashboard(userId: string) {
  await ensureAutoPostBootstrap(userId);
  const [sourceConfig, platformSettings, articles, jobsByStatusRaw] = await Promise.all([
    prisma.articleSourceConfig.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" }
    }),
    prisma.autoPostPlatformSetting.findMany({
      where: { userId },
      orderBy: { platform: "asc" }
    }),
    prisma.article.findMany({
      where: { userId },
      include: {
        jobs: true
      },
      orderBy: { publishedAt: "desc" },
      take: 50
    }),
    prisma.autoPostJob.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true }
    })
  ]);

  const jobsByStatus = jobsByStatusRaw.map((row) => ({
    status: row.status,
    _count: row._count._all
  }));

  return {
    sourceConfig,
    platformSettings,
    articles,
    jobsByStatus
  };
}

export async function updateAutoPostSourceConfig(userId: string, input: {
  rssUrl?: string;
  enabled?: boolean;
  immediatePublishEnabled?: boolean;
  assetsPersistenceEnabled?: boolean;
}) {
  const current = await ensureArticleSourceConfig(userId);
  return prisma.articleSourceConfig.update({
    where: { id: current.id },
    data: {
      rssUrl: input.rssUrl ?? current.rssUrl,
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      immediatePublishEnabled:
        typeof input.immediatePublishEnabled === "boolean" ? input.immediatePublishEnabled : current.immediatePublishEnabled,
      assetsPersistenceEnabled:
        typeof input.assetsPersistenceEnabled === "boolean" ? input.assetsPersistenceEnabled : current.assetsPersistenceEnabled
    }
  });
}

export async function updateAutoPostPlatformSetting(
  userId: string,
  platform: SocialPlatform,
  input: {
    enabled?: boolean;
    maxPostsPerDay?: number;
    minIntervalMinutes?: number;
    requireApproval?: boolean;
  }
) {
  await ensureAutoPostBootstrap(userId);
  const existing = await prisma.autoPostPlatformSetting.findUnique({
    where: {
      userId_platform: {
        userId,
        platform
      }
    }
  });

  if (!existing) {
    throw new Error("Platform setting not found");
  }

  return prisma.autoPostPlatformSetting.update({
    where: { id: existing.id },
    data: {
      enabled: typeof input.enabled === "boolean" ? input.enabled : existing.enabled,
      maxPostsPerDay:
        typeof input.maxPostsPerDay === "number" ? Math.max(1, Math.min(100, Math.floor(input.maxPostsPerDay))) : existing.maxPostsPerDay,
      minIntervalMinutes:
        typeof input.minIntervalMinutes === "number"
          ? Math.max(1, Math.min(24 * 60, Math.floor(input.minIntervalMinutes)))
          : existing.minIntervalMinutes,
      requireApproval: typeof input.requireApproval === "boolean" ? input.requireApproval : existing.requireApproval
    }
  });
}

export async function toggleArticleAutopost(userId: string, articleId: string, enabled: boolean) {
  return prisma.article.updateMany({
    where: { id: articleId, userId },
    data: { autopostEnabled: enabled }
  });
}

export async function regenerateWithoutRepublish(userId: string, articleId: string) {
  await generateForArticle(userId, articleId, true);
  await prisma.autoPostJob.updateMany({
    where: { userId, articleId },
    data: {
      status: AutoPostJobStatus.generated,
      externalPostId: null,
      publishedAt: null,
      errorMessage: null
    }
  });
}

export async function createDemoQueueItemsFromArticles(userId: string) {
  const articles = await prisma.article.findMany({
    where: { userId },
    orderBy: { publishedAt: "desc" },
    take: 10
  });

  if (articles.length === 0) return { created: 0 };

  const defaultFlow = await prisma.flow.findFirst({
    where: {
      userId,
      isEnabled: true,
      name: { not: AUTOPOST_SYSTEM_FLOW_NAME }
    },
    orderBy: { createdAt: "asc" }
  });
  if (!defaultFlow) return { created: 0 };

  let created = 0;
  for (const article of articles) {
    const exists = await prisma.postQueueItem.findFirst({
      where: {
        userId,
        flowId: defaultFlow.id,
        linkUrl: article.canonicalUrl
      }
    });
    if (exists) continue;
    await prisma.postQueueItem.create({
      data: {
        userId,
        flowId: defaultFlow.id,
        status: QueueStatus.pending,
        topicText: article.title,
        title: article.title,
        body: article.excerpt ?? article.content.slice(0, 450),
        linkUrl: article.canonicalUrl
      }
    });
    created += 1;
  }

  return { created };
}
