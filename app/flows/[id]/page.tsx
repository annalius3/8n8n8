import Link from "next/link";
import { notFound } from "next/navigation";
import { QueueStatus } from "@prisma/client";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RunNowButton } from "@/components/run-now-button";
import { FlowEditor } from "@/components/flow-editor";
import { JsonView } from "@/components/json-view";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { IntegrationModePanel } from "@/components/integration-mode-panel";
import { PostPreviewCard } from "@/components/post-preview-card";
import { SourcePreviewCard } from "@/components/source-preview-card";
import { FlowReadinessCard } from "@/components/flow-readiness-card";
import { DemoRunBanner } from "@/components/demo-run-banner";
import { SetupRequiredCard } from "@/components/setup-required-card";
import { getIntegrationModes } from "@/lib/integrations/runtime";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("ru-RU") : "—";
}

function getStepCaption(type: string) {
  const map: Record<string, string> = {
    schedule: "Определяет, когда поток должен запускаться.",
    rss: "Забирает элементы из RSS и отсеивает уже опубликованные.",
    queue: "Берёт отложенный пост из базы и ставит lock на время обработки.",
    template: "Собирает финальный заголовок и описание поста.",
    ai_image_leonardo: "Генерирует изображение или имитирует его в демо-сценарии.",
    pinterest_publish: "Публикует пост в Pinterest или возвращает demo post id.",
    delay: "Делает паузу между шагами."
  };

  return map[type] ?? "Пользовательский шаг.";
}

function getStepMode(type: string, runtime: Record<string, any> | null) {
  if (!runtime) return null;
  if (["template", "ai_text"].includes(type)) return runtime.openai;
  if (["ai_image_leonardo", "ai_image"].includes(type)) return runtime.leonardo;
  if (["pinterest_publish", "publish_pinterest"].includes(type)) return runtime.pinterest;
  return null;
}

function formatModeLabel(mode: string | null) {
  if (!mode) return null;
  return mode === "real" ? "Real API" : "Demo";
}

export default async function FlowEditorPage({ params }: Props) {
  const modes = getIntegrationModes();

  try {
    const user = await requireUser();
    const { id } = await params;

    const flow = await prisma.flow.findFirst({
      where: { id, userId: user.id },
      include: {
        schedule: true,
        steps: { orderBy: { orderIndex: "asc" } },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            steps: { orderBy: { stepIndex: "asc" } }
          }
        }
      }
    });

    if (!flow || !flow.schedule) {
      notFound();
    }

    const sourceStep = flow.steps.find((step) => ["rss", "queue", "source_rss", "source_queue"].includes(step.type));
    const isQueueSource = sourceStep ? ["queue", "source_queue"].includes(sourceStep.type) : false;
    const nextQueueItem = isQueueSource
      ? await prisma.postQueueItem.findFirst({
          where: {
            userId: user.id,
            status: QueueStatus.pending
          },
          orderBy: { createdAt: "asc" }
        })
      : null;
    const queuePendingCount = isQueueSource
      ? await prisma.postQueueItem.count({
          where: {
            userId: user.id,
            status: QueueStatus.pending
          }
        })
      : 0;

    const lastRun = flow.runs[0];
    const context = (lastRun?.contextJson as Record<string, any> | null) ?? null;
    const runtime = (context?.runtime as Record<string, any> | null) ?? null;
    const isDemoRun = Boolean(runtime && Object.values(runtime).some((value) => value === "demo"));
    const preview = {
      title: context?.text?.pin_title ?? "Здесь появится заголовок после запуска",
      description: context?.text?.pin_description ?? "Здесь появится описание будущего поста",
      imageUrl: context?.image?.image_url ?? null,
      linkUrl: context?.source?.link_url ?? null,
      boardId: context?.publish?.board_id ?? ((flow.steps.find((step) => step.type === "pinterest_publish")?.configJson as any)?.board_id ?? null),
      textMode: context?.text?.provider_mode ?? null,
      imageMode: context?.image?.provider_mode ?? null,
      publishMode: context?.publish?.mode ?? null
    };

    const blockers: string[] = [];
    const hints: string[] = [];

    if (!flow.isEnabled) blockers.push("Поток выключен. Scheduler не будет его запускать, пока вы не включите flow.");
    if (flow.schedule.isPaused) blockers.push("Расписание поставлено на паузу. Автоматический запуск сейчас остановлен.");
    if (!sourceStep) blockers.push("Не найден шаг источника. Поток не понимает, откуда брать контент.");
    if (isQueueSource && !nextQueueItem) blockers.push("Очередь пуста. Для queue-потока нужно добавить хотя бы один pending item.");
    if (!flow.steps.some((step) => ["pinterest_publish", "publish_pinterest"].includes(step.type))) {
      blockers.push("В потоке нет шага публикации. Сейчас он обработает данные, но ничего не отправит наружу.");
    }

    if (!lastRun) hints.push("Поток ещё не запускался. Нажмите «Запустить сейчас», чтобы заполнить preview, timeline и context.");
    if (sourceStep && ["rss", "source_rss"].includes(sourceStep.type)) {
      const cfg = (sourceStep.configJson ?? {}) as Record<string, any>;
      hints.push(`RSS-источник читает feed: ${cfg.rss_url ?? "не указан"}. Если новых элементов нет, run завершится сообщением об отсутствии новых RSS items.`);
    }
    if (isQueueSource) {
      hints.push(`Сейчас в очереди pending items: ${queuePendingCount}. После публикации item перейдёт в статус published.`);
    }
    if (modes.pinterest === "demo") {
      hints.push("Публикация Pinterest пока работает как demo-stub: вы увидите post id и логи, но реальный Pinterest API ещё не подключён.");
    }
    if (lastRun?.error) {
      hints.push(`Последняя ошибка: ${lastRun.error}`);
    }

    const sourcePreview = (() => {
      if (!sourceStep) {
        return {
          sourceType: "unknown" as const,
          sourceLabel: "Источник не настроен",
          summary: "Добавьте шаг rss или queue, чтобы поток мог брать исходный материал.",
          details: [
            { label: "Следующий запуск", value: formatDate(flow.schedule.nextRunAt) },
            { label: "Статус flow", value: flow.isEnabled ? "Включён" : "Выключен" }
          ]
        };
      }

      if (["rss", "source_rss"].includes(sourceStep.type)) {
        const cfg = (sourceStep.configJson ?? {}) as Record<string, any>;
        return {
          sourceType: "rss" as const,
          sourceLabel: cfg.rss_url ? `RSS: ${cfg.rss_url}` : "RSS URL не указан",
          summary: "Поток будет брать новые элементы из RSS и пропускать уже опубликованные записи по dedupe-правилу.",
          details: [
            { label: "take", value: String(cfg.take ?? 1) },
            { label: "dedupe platform", value: String(cfg.dedupe?.platform ?? "pinterest") },
            { label: "Следующий запуск", value: formatDate(flow.schedule.nextRunAt) },
            { label: "Последний запуск", value: formatDate(lastRun?.startedAt) }
          ]
        };
      }

      return {
        sourceType: "queue" as const,
        sourceLabel: nextQueueItem?.title ?? "Следующий pending item пока не найден",
        summary: nextQueueItem?.body ?? "Когда в очереди появятся pending items, здесь будет показан следующий кандидат на публикацию.",
        details: [
          { label: "pending items", value: String(queuePendingCount) },
          { label: "next item id", value: nextQueueItem?.id ?? "—" },
          { label: "link_url", value: nextQueueItem?.linkUrl ?? "—" },
          { label: "Следующий запуск", value: formatDate(flow.schedule.nextRunAt) }
        ]
      };
    })();

    return (
      <div className="space-y-6">
        <IntegrationModePanel modes={modes} />
        <DemoRunBanner
          isDemo={isDemoRun}
          text="Последний запуск проходил частично или полностью в demo-режиме. Preview и context полезны для проверки сценария, но не все внешние API вызывались по-настоящему."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/flows">
            <Button variant="outline">Назад к потокам</Button>
          </Link>
          <RunNowButton flowId={flow.id} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Как работает поток</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {flow.steps.map((step, index) => {
                const stepMode = formatModeLabel(getStepMode(step.type, runtime));

                return (
                  <div key={step.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          Шаг {index + 1}. <span className="font-mono">{step.type}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{getStepCaption(step.type)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {stepMode ? <Badge variant="outline">{stepMode}</Badge> : null}
                        <Badge variant="outline">#{step.orderIndex + 1}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <PostPreviewCard
              title={preview.title}
              description={preview.description}
              imageUrl={preview.imageUrl}
              linkUrl={preview.linkUrl}
              boardId={preview.boardId}
              textMode={preview.textMode}
              imageMode={preview.imageMode}
              publishMode={preview.publishMode}
            />

            {!lastRun ? (
              <Card>
                <CardHeader>
                  <CardTitle>Что увидеть после первого запуска</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Источник заполнит `context.source` данными RSS или очереди.</p>
                  <p>2. Шаг текста создаст pin title и pin description.</p>
                  <p>3. Шаг картинки добавит image URL в preview.</p>
                  <p>4. Шаг публикации вернёт demo post id или реальный результат интеграции.</p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Последний запуск</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Статус</span>
                  {lastRun ? (
                    lastRun.status === "failed" ? <Badge variant="destructive">Ошибка</Badge> : lastRun.status === "running" ? <Badge variant="secondary">Выполняется</Badge> : <Badge>Успешно</Badge>
                  ) : (
                    <Badge variant="outline">Ещё не запускался</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Старт</span>
                  <span>{formatDate(lastRun?.startedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Завершение</span>
                  <span>{formatDate(lastRun?.finishedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Следующий запуск</span>
                  <span>{formatDate(flow.schedule.nextRunAt)}</span>
                </div>
                {lastRun?.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{lastRun.error}</div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Execution timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionTimeline
                  steps={(lastRun?.steps ?? []).map((step) => ({
                    id: step.id,
                    label: step.stepType,
                    status: step.status,
                    mode:
                      typeof (step.outputJson as Record<string, any> | null)?.mode === "string"
                        ? String((step.outputJson as Record<string, any>).mode)
                        : typeof (step.outputJson as Record<string, any> | null)?.provider === "string"
                          ? String((step.outputJson as Record<string, any>).provider)
                          : null,
                    error: step.error
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SourcePreviewCard
            sourceType={sourcePreview.sourceType}
            sourceLabel={sourcePreview.sourceLabel}
            summary={sourcePreview.summary}
            details={sourcePreview.details}
          />
          <FlowReadinessCard blockers={blockers} hints={hints} />
        </div>

        <FlowEditor
          flowId={flow.id}
          initialName={flow.name}
          initialEnabled={flow.isEnabled}
          initialCron={flow.schedule.cron}
          initialTimezone={flow.schedule.timezone}
          initialMaxRunsPerDay={flow.schedule.maxRunsPerDay}
          initialIsPaused={flow.schedule.isPaused}
          initialSteps={flow.steps.map((step) => ({
            type: step.type,
            configJson: step.configJson as Record<string, unknown>
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle>Context последнего запуска</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView value={context} emptyLabel="После первого запуска здесь появится полный context JSON." />
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="space-y-6">
        <IntegrationModePanel modes={modes} />
        <SetupRequiredCard details="Редактор потока не может загрузиться без рабочей базы данных. Добавьте `DATABASE_URL` и остальные обязательные ENV в Vercel." />
      </div>
    );
  }
}
