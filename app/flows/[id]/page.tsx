import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function FlowEditorPage({ params }: Props) {
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

  const lastRun = flow.runs[0];
  const modes = getIntegrationModes();
  const context = (lastRun?.contextJson as Record<string, any> | null) ?? null;
  const preview = {
    title: context?.text?.pin_title ?? "Здесь появится заголовок после запуска",
    description: context?.text?.pin_description ?? "Здесь появится описание будущего поста",
    imageUrl: context?.image?.image_url ?? null,
    linkUrl: context?.source?.link_url ?? null,
    boardId: context?.publish?.board_id ?? ((flow.steps.find((step) => step.type === "pinterest_publish")?.configJson as any)?.board_id ?? null)
  };

  return (
    <div className="space-y-6">
      <IntegrationModePanel modes={modes} />
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/flows">
          <Button variant="outline">Назад к потокам</Button>
        </Link>
        <RunNowButton flowId={flow.id} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Как работает поток</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {flow.steps.map((step, index) => (
              <div key={step.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Шаг {index + 1}. <span className="font-mono">{step.type}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{getStepCaption(step.type)}</p>
                  </div>
                  <Badge variant="outline">#{step.orderIndex + 1}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Предпросмотр публикации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Заголовок</p>
                <p className="mt-1 text-sm font-medium">{preview.title}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Описание</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{preview.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Изображение</p>
                  {preview.imageUrl ? (
                    <a href={preview.imageUrl} className="mt-1 block break-all text-sm text-sky-700 underline" target="_blank">
                      {preview.imageUrl}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Появится после запуска flow.</p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Ссылка и board</p>
                  <p className="mt-1 text-sm">{preview.linkUrl ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">board: {preview.boardId ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
}
