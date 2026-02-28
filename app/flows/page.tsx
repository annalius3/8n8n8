import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationModePanel } from "@/components/integration-mode-panel";
import { getIntegrationModes } from "@/lib/integrations/runtime";
import { LinkButton } from "@/components/ui/link-button";
import { SchedulerTickButton } from "@/components/scheduler-tick-button";

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("ru-RU") : "—";
}

export default async function FlowsPage() {
  const user = await requireUser("/flows");
  const modes = getIntegrationModes();

  const flows = await prisma.flow.findMany({
    where: { userId: user.id },
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

  return (
    <div className="space-y-6">
      <IntegrationModePanel modes={modes} />

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Campaigns / Flows</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Здесь создаются кампании от Seed Topic до очереди публикаций, генерации контента и автопостинга.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SchedulerTickButton />
            <LinkButton href="/settings" variant="outline">Settings</LinkButton>
            <LinkButton href="/flows/new">Создать campaign</LinkButton>
          </div>
        </CardHeader>
      </Card>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Пока нет campaign. Создайте первую кампанию через Seed Topic wizard.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {flows.map((flow) => {
          const lastRun = flow.runs[0];
          const pending = flow.queueItems.filter((item) => item.status === "pending").length;
          const ready = flow.queueItems.filter((item) => item.status === "ready").length;
          const published = flow.queueItems.filter((item) => item.status === "published").length;

          return (
            <Card key={flow.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/flows/${flow.id}` as any} className="text-lg font-semibold underline-offset-4 hover:underline">
                      {flow.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">Seed Topic: {flow.seedTopic ?? "—"}</p>
                  </div>
                  {flow.isEnabled ? <Badge>Включён</Badge> : <Badge variant="secondary">Выключен</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{flow.language}</Badge>
                  <Badge variant="outline">{flow.postsPerDay} posts/day</Badge>
                  <Badge variant="outline">{flow.timezone}</Badge>
                  <Badge variant="outline">start {flow.startTime}</Badge>
                  {flow.autopublishEnabled ? <Badge>autopublish</Badge> : <Badge variant="secondary">manual publish</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Topics</p>
                    <p className="mt-1 text-sm font-medium">{flow.topicSuggestions.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Queue</p>
                    <p className="mt-1 text-sm font-medium">{flow.queueItems.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Pending / Ready</p>
                    <p className="mt-1 text-sm font-medium">{pending} / {ready}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Published</p>
                    <p className="mt-1 text-sm font-medium">{published}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  <p>Последний запуск: {formatDate(lastRun?.startedAt)}</p>
                  <p>Статус: {lastRun?.status ?? "ещё не было запусков"}</p>
                  {lastRun?.error ? <p className="mt-2 text-red-600">{lastRun.error}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <LinkButton href={`/flows/${flow.id}` as any} variant="outline">Overview</LinkButton>
                  <LinkButton href={`/flows/${flow.id}/topics` as any} variant="outline">Topics</LinkButton>
                  <LinkButton href={`/flows/${flow.id}/queue` as any} variant="outline">Queue</LinkButton>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
