import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RunNowButton } from "@/components/run-now-button";
import { SchedulerTickButton } from "@/components/scheduler-tick-button";
import { FlowToggleButton } from "@/components/flow-toggle-button";
import { IntegrationModePanel } from "@/components/integration-mode-panel";
import { getIntegrationModes } from "@/lib/integrations/runtime";

type FlowWithMeta = Awaited<ReturnType<typeof loadFlows>>[number];

async function loadFlows(userId: string) {
  return prisma.flow.findMany({
    where: { userId },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

function getSourceLabel(flow: FlowWithMeta) {
  const step = flow.steps.find((item) => ["rss", "queue", "source_rss", "source_queue"].includes(item.type));
  if (!step) return "Не указан";
  if (["rss", "source_rss"].includes(step.type)) return "RSS";
  if (["queue", "source_queue"].includes(step.type)) return "Очередь из БД";
  return step.type;
}

function getTargetLabel(flow: FlowWithMeta) {
  const step = flow.steps.find((item) => ["pinterest_publish", "publish_pinterest"].includes(item.type));
  if (!step) return "Не указан";
  const config = step.configJson as { board_id?: string };
  return config.board_id ? `Pinterest · board ${config.board_id}` : "Pinterest";
}

function getLastStatusBadge(flow: FlowWithMeta) {
  const run = flow.runs[0];
  if (!run) return <Badge variant="outline">Ещё не запускался</Badge>;
  if (run.status === "failed") return <Badge variant="destructive">Ошибка</Badge>;
  if (run.status === "running") return <Badge variant="secondary">Выполняется</Badge>;
  return <Badge>Успешно</Badge>;
}

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("ru-RU") : "—";
}

function describeFlow(flow: FlowWithMeta) {
  return `${getSourceLabel(flow)} -> ${flow.steps.map((step) => step.type).join(" -> ")}`;
}

function getCompactPreview(flow: FlowWithMeta) {
  const context = (flow.runs[0]?.contextJson as Record<string, any> | null) ?? null;

  return {
    title: context?.text?.pin_title ?? "Запустите поток, чтобы увидеть будущий заголовок поста.",
    description: context?.text?.pin_description ?? "После первого запуска здесь появится краткий preview публикации.",
    imageUrl: context?.image?.image_url ?? null,
    mode: context?.publish?.mode ?? null
  };
}

export default async function FlowsPage() {
  const user = await requireUser();
  const flows = await loadFlows(user.id);
  const modes = getIntegrationModes();

  return (
    <div className="space-y-6">
      <IntegrationModePanel modes={modes} />
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Потоки автопостинга</CardTitle>
            <p className="text-sm text-muted-foreground">
              Здесь видно, откуда приходит контент, что с ним происходит и когда он будет опубликован.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SchedulerTickButton />
            <Link href="/flows/new">
              <Button>Создать поток</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">1. Источник</p>
            <p className="mt-1 text-sm text-muted-foreground">RSS или очередь из базы. На этом шаге поток получает материал для публикации.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">2. Обработка</p>
            <p className="mt-1 text-sm text-muted-foreground">Текст и изображение можно генерировать в демо-режиме без реальных ключей.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">3. Публикация</p>
            <p className="mt-1 text-sm text-muted-foreground">Даже без реального Pinterest вы увидите весь маршрут в логах и итоговый context.</p>
          </div>
        </CardContent>
      </Card>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Потоков пока нет. Создайте первый поток и проверьте весь сценарий на демо-данных.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {flows.map((flow) => {
          const lastRun = flow.runs[0];
          const preview = getCompactPreview(flow);

          return (
            <Card key={flow.id} className="border-slate-200 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Link href={`/flows/${flow.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                      {flow.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{describeFlow(flow)}</p>
                  </div>
                  {flow.isEnabled ? <Badge>Включён</Badge> : <Badge variant="secondary">Выключен</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">{getLastStatusBadge(flow)}</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Источник</p>
                    <p className="mt-1 text-sm font-medium">{getSourceLabel(flow)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Цель</p>
                    <p className="mt-1 text-sm font-medium">{getTargetLabel(flow)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Расписание</p>
                    <p className="mt-1 text-sm font-medium">{flow.schedule?.cron ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{flow.schedule?.timezone ?? "Europe/Kiev"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Следующий запуск</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(flow.schedule?.nextRunAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Последний запуск</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(lastRun?.startedAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Шагов в потоке</p>
                    <p className="mt-1 text-sm font-medium">{flow.steps.length}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="grid gap-0 md:grid-cols-[140px_1fr]">
                    <div className="aspect-[4/5] border-b bg-gradient-to-br from-slate-100 via-white to-slate-200 md:border-b-0 md:border-r">
                      {preview.imageUrl ? (
                        <img src={preview.imageUrl} alt={preview.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                          Пока без изображения
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs uppercase text-muted-foreground">Мини-preview</p>
                        {preview.mode ? <Badge variant="outline">{preview.mode === "real" ? "Real API" : "Demo"}</Badge> : null}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{preview.title}</p>
                        <p className="mt-2 max-h-24 overflow-hidden text-sm text-muted-foreground">{preview.description}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <RunNowButton flowId={flow.id} />
                  <FlowToggleButton flowId={flow.id} initialEnabled={flow.isEnabled} />
                  <Link href={`/flows/${flow.id}`}>
                    <Button variant="outline">Открыть редактор</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
