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

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("en-US") : "—";
}

function translateRunStatus(status: string | undefined) {
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "no runs yet";
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

  return (
    <div className="space-y-6">
      <IntegrationModePanel modes={modes} />

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Scheduled publishing flows</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Build flows from a seed topic to scheduled content, queue management, and controlled publishing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SchedulerTickButton />
            <LinkButton href="/settings" variant="outline">Settings</LinkButton>
            <LinkButton href="/flows/new">Create flow</LinkButton>
          </div>
        </CardHeader>
      </Card>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No flows yet. Create your first one from a seed topic.
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
                    <p className="mt-1 text-sm text-muted-foreground">Seed topic: {flow.seedTopic ?? "—"}</p>
                  </div>
                  {flow.isEnabled ? <Badge>Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{flow.language}</Badge>
                  <Badge variant="outline">{flow.postsPerDay} posts/day</Badge>
                  <Badge variant="outline">{flow.timezone}</Badge>
                  <Badge variant="outline">start {flow.startTime}</Badge>
                  {flow.autopublishEnabled ? <Badge>scheduled publishing</Badge> : <Badge variant="secondary">manual publishing</Badge>}
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
                    <p className="text-xs uppercase text-muted-foreground">Pending / ready</p>
                    <p className="mt-1 text-sm font-medium">{pending} / {ready}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Published</p>
                    <p className="mt-1 text-sm font-medium">{published}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  <p>Last run: {formatDate(lastRun?.startedAt)}</p>
                  <p>Status: {translateRunStatus(lastRun?.status)}</p>
                  {lastRun?.error ? <p className="mt-2 text-red-600">{lastRun.error}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <FlowToggleButton flowId={flow.id} initialEnabled={flow.isEnabled} />
                  <DeleteFlowButton flowId={flow.id} />
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
