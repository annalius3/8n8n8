import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { CampaignSettingsForm } from "@/components/campaign-settings-form";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { FlowToggleButton } from "@/components/flow-toggle-button";
import { DeleteFlowButton } from "@/components/delete-flow-button";

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("ru-RU") : "—";
}

function translateRunStatus(status: string | undefined) {
  if (status === "success") return "Успешно";
  if (status === "failed") return "Ошибка";
  if (status === "running") return "Выполняется";
  return "—";
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FlowOverviewPage({ params }: Props) {
  const user = await requireUser("/flows");
  const { id } = await params;

  const [flow, pinterestConnections] = await Promise.all([
    prisma.flow.findFirst({
      where: { id, userId: user.id },
      include: {
        schedule: true,
        steps: { orderBy: { orderIndex: "asc" } },
        topicSuggestions: true,
        queueItems: {
          orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
          take: 10
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 10,
          include: {
            steps: { orderBy: { stepIndex: "asc" } }
          }
        }
      }
    }),
    prisma.connection.findMany({
      where: {
        userId: user.id,
        provider: "pinterest"
      },
      select: {
        name: true
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  if (!flow) {
    notFound();
  }

  const lastRun = flow.runs[0];
  const readyCount = flow.queueItems.filter((item) => item.status === "ready").length;
  const publishedCount = flow.queueItems.filter((item) => item.status === "published").length;
  const publishConfig = (flow.steps.find((step) => step.type === "pinterest_publish")?.configJson ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/flows" variant="outline">К списку потоков</LinkButton>
        <LinkButton href={`/flows/${flow.id}/topics`} variant="outline">Темы</LinkButton>
        <LinkButton href={`/flows/${flow.id}/queue`} variant="outline">Очередь</LinkButton>
        <LinkButton href="/settings" variant="outline">Настройки</LinkButton>
        <FlowToggleButton flowId={flow.id} initialEnabled={flow.isEnabled} />
        <DeleteFlowButton flowId={flow.id} redirectToFlows />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{flow.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Исходная тема</p>
            <p className="mt-1 text-sm font-medium">{flow.seedTopic ?? "—"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Язык</p>
            <p className="mt-1 text-sm font-medium">{flow.language}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Постов в день</p>
            <p className="mt-1 text-sm font-medium">{flow.postsPerDay}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Статус</p>
            <p className="mt-1 text-sm font-medium">{flow.isEnabled ? "Включён" : "Выключен"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Темы</p>
            <p className="mt-1 text-sm font-medium">{flow.topicSuggestions.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Готово</p>
            <p className="mt-1 text-sm font-medium">{readyCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Опубликовано</p>
            <p className="mt-1 text-sm font-medium">{publishedCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Автопубликация</p>
            <p className="mt-1 text-sm font-medium">{flow.autopublishEnabled ? "Да" : "Нет"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <CampaignSettingsForm
          flowId={flow.id}
          initialName={flow.name}
          initialLanguage={flow.language}
          initialPostsPerDay={flow.postsPerDay}
          initialTimezone={flow.timezone}
          initialStartTime={flow.startTime}
          initialAutopublishEnabled={flow.autopublishEnabled}
          initialCron={flow.schedule?.cron}
          initialNiche={flow.niche}
          initialAudience={flow.audience}
          initialTone={flow.tone}
          initialPinterestConnectionName={typeof publishConfig.connection_name === "string" ? publishConfig.connection_name : ""}
          initialPinterestBoardId={typeof publishConfig.board_id === "string" ? publishConfig.board_id : ""}
          availablePinterestConnections={pinterestConnections.map((connection) => connection.name)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Последний запуск</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <p>Старт: {formatDate(lastRun?.startedAt)}</p>
              <p>Завершение: {formatDate(lastRun?.finishedAt)}</p>
              <p>
                Статус:{" "}
                {lastRun ? (
                  <Badge variant={lastRun.status === "failed" ? "destructive" : lastRun.status === "running" ? "secondary" : "default"}>
                    {translateRunStatus(lastRun.status)}
                  </Badge>
                ) : (
                  "—"
                )}
              </p>
              {lastRun?.error ? <p className="mt-2 text-red-600">{lastRun.error}</p> : null}
            </div>
            <ExecutionTimeline
              steps={(lastRun?.steps ?? []).map((step) => ({
                id: step.id,
                label: step.stepType,
                status: step.status,
                error: step.error,
                mode: typeof (step.outputJson as Record<string, unknown> | null)?.mode === "string" ? String((step.outputJson as Record<string, unknown>).mode) : null
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ближайшие элементы очереди</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flow.queueItems.length > 0 ? (
            flow.queueItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.topicText ?? item.title}</p>
                    <p className="text-muted-foreground">{item.title}</p>
                  </div>
                  <Badge variant={item.status === "failed" ? "destructive" : item.status === "published" ? "default" : "outline"}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">scheduled_at: {formatDate(item.scheduledAt)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Очередь пока пуста. Перейдите в раздел тем и добавьте подходящие темы в очередь.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

