import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationModePanel } from "@/components/integration-mode-panel";
import { getIntegrationModes } from "@/lib/integrations/runtime";
import { LinkButton } from "@/components/ui/link-button";
import { SchedulerTickButton } from "@/components/scheduler-tick-button";
import { FlowToggleButton } from "@/components/flow-toggle-button";
import { DeleteFlowButton } from "@/components/delete-flow-button";
import { NextPublicationCountdown } from "@/components/next-publication-countdown";

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("ru-RU") : "—";
}

function translateRunStatus(status: string | undefined) {
  if (status === "success") return "Успешно";
  if (status === "failed") return "Ошибка";
  if (status === "running") return "Выполняется";
  return "запусков ещё не было";
}

export default async function FlowsPage() {
  const user = await requireUser("/flows");
  const [baseModes, hasPinterestConnection] = await Promise.all([
    Promise.resolve(getIntegrationModes()),
    prisma.connection.findFirst({
      where: {
        userId: user.id,
        provider: "pinterest"
      },
      select: { id: true }
    })
  ]);
  const modes = {
    ...baseModes,
    pinterest: hasPinterestConnection ? "real" : baseModes.pinterest
  };

  const flows = await prisma.flow.findMany({
    where: {
      userId: user.id,
      id: { not: "seed-flow-rss-pinterest" }
    },
    include: {
      topicSuggestions: true,
      queueItems: true,
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const nextPublication = flows
    .flatMap((flow) =>
      flow.queueItems
        .filter((item) => item.publishedAt === null && item.scheduledAt)
        .map((item) => ({
          flowId: flow.id,
          flowName: flow.name,
          scheduledAt: item.scheduledAt as Date
        }))
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  return (
    <div className="space-y-6">
      <IntegrationModePanel modes={modes} />

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Потоки автопостинга</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Создавайте потоки автопостинга: от одной темы до 50 идей, генерации контента и публикации в Pinterest по расписанию.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SchedulerTickButton />
            <LinkButton href="/settings" variant="outline">Настройки</LinkButton>
            <LinkButton href="/flows/new">Создать поток</LinkButton>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Следующая публикация</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Через</p>
            <p className="mt-1 text-lg font-semibold">
              <NextPublicationCountdown scheduledAt={nextPublication?.scheduledAt.toISOString() ?? null} />
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Поток</p>
            <p className="mt-1 text-sm font-medium">{nextPublication?.flowName ?? "Нет запланированных публикаций"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Время</p>
            <p className="mt-1 text-sm font-medium">{formatDate(nextPublication?.scheduledAt)}</p>
          </div>
        </CardContent>
      </Card>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Потоков пока нет. Создайте первый поток из исходной темы.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {flows.map((flow) => {
          const lastRun = flow.runs[0];
          const pending = flow.queueItems.filter((item) => item.status === "pending").length;
          const ready = flow.queueItems.filter((item) => item.status === "ready").length;
          const published = flow.queueItems.filter((item) => item.status === "published").length;
          const nextFlowPublication = flow.queueItems
            .filter((item) => item.publishedAt === null && item.scheduledAt)
            .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))[0];

          return (
            <Card key={flow.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/flows/${flow.id}` as any} className="text-lg font-semibold underline-offset-4 hover:underline">
                      {flow.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">Исходная тема: {flow.seedTopic ?? "—"}</p>
                  </div>
                  {flow.isEnabled ? <Badge>Включён</Badge> : <Badge variant="secondary">Выключен</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{flow.language}</Badge>
                  <Badge variant="outline">{flow.postsPerDay} публикаций/день</Badge>
                  <Badge variant="outline">{flow.timezone}</Badge>
                  <Badge variant="outline">старт {flow.startTime}</Badge>
                  {flow.autopublishEnabled ? <Badge>автопостинг включён</Badge> : <Badge variant="secondary">ручная публикация</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Темы</p>
                    <p className="mt-1 text-sm font-medium">{flow.topicSuggestions.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Очередь</p>
                    <p className="mt-1 text-sm font-medium">{flow.queueItems.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">В ожидании / готово</p>
                    <p className="mt-1 text-sm font-medium">{pending} / {ready}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Опубликовано</p>
                    <p className="mt-1 text-sm font-medium">{published}</p>
                  </div>
                  <div className="rounded-lg border p-3 md:col-span-2">
                    <p className="text-xs uppercase text-muted-foreground">Следующая публикация</p>
                    <p className="mt-1 text-sm font-medium">
                      <NextPublicationCountdown scheduledAt={nextFlowPublication?.scheduledAt?.toISOString() ?? null} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(nextFlowPublication?.scheduledAt)}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  <p>Последний запуск: {formatDate(lastRun?.startedAt)}</p>
                  <p>Статус: {translateRunStatus(lastRun?.status)}</p>
                  {lastRun?.error ? <p className="mt-2 text-red-600">{lastRun.error}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <FlowToggleButton flowId={flow.id} initialEnabled={flow.isEnabled} />
                  <DeleteFlowButton flowId={flow.id} />
                  <LinkButton href={`/flows/${flow.id}` as any} variant="outline">Обзор</LinkButton>
                  <LinkButton href={`/flows/${flow.id}/topics` as any} variant="outline">Темы</LinkButton>
                  <LinkButton href={`/flows/${flow.id}/queue` as any} variant="outline">Очередь</LinkButton>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
