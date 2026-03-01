import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JsonView } from "@/components/json-view";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { SetupRequiredCard } from "@/components/setup-required-card";
import { LinkButton } from "@/components/ui/link-button";

type Props = {
  searchParams?: Promise<{ status?: string }>;
};

async function loadRuns(userId: string, status: "all" | "success" | "failed" | "running") {
  return prisma.jobRun.findMany({
    where: {
      flow: { userId },
      ...(status !== "all" ? { status } : {})
    },
    include: {
      flow: true,
      steps: { orderBy: { stepIndex: "asc" } }
    },
    orderBy: { startedAt: "desc" },
    take: 50
  });
}

function translateRunStatus(status: string) {
  if (status === "failed") return { label: "Failed", variant: "destructive" as const };
  if (status === "success") return { label: "Success", variant: "default" as const };
  if (status === "running") return { label: "Running", variant: "secondary" as const };
  return { label: status, variant: "outline" as const };
}

function translateStepStatus(status: string) {
  if (status === "failed") return { label: "Failed", variant: "destructive" as const };
  if (status === "success") return { label: "Success", variant: "default" as const };
  if (status === "skipped") return { label: "Skipped", variant: "outline" as const };
  return { label: status, variant: "outline" as const };
}

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString("en-US") : "—";
}

export default async function RunsPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const activeStatus =
    params?.status === "success" || params?.status === "failed" || params?.status === "running" ? params.status : "all";

  const user = await requireUser("/runs");

  let runs: Awaited<ReturnType<typeof loadRuns>> = [];
  try {
    runs = await loadRuns(user.id, activeStatus);
  } catch {
    return (
      <div className="space-y-6">
        <SetupRequiredCard details="The runs page requires a working database connection." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page shows the full execution path: which steps ran, what they received as input, and what they wrote to output/context.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/runs" variant={activeStatus === "all" ? "default" : "outline"} size="sm">All</LinkButton>
            <LinkButton href="/runs?status=success" variant={activeStatus === "success" ? "default" : "outline"} size="sm">Successful</LinkButton>
            <LinkButton href="/runs?status=failed" variant={activeStatus === "failed" ? "default" : "outline"} size="sm">Failed</LinkButton>
            <LinkButton href="/runs?status=running" variant={activeStatus === "running" ? "default" : "outline"} size="sm">Running</LinkButton>
          </div>
        </CardContent>
      </Card>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No runs yet. Create a flow, generate topics, and run actions in the queue.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {runs.map((run) => {
          const runStatus = translateRunStatus(run.status);

          return (
            <Card key={run.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{run.flow.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Run ID: {run.id}</p>
                  </div>
                  <Badge variant={runStatus.variant}>{runStatus.label}</Badge>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Started</p>
                    <p className="mt-1">{formatDate(run.startedAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Finished</p>
                    <p className="mt-1">{formatDate(run.finishedAt)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase text-muted-foreground">Error</p>
                    <p className="mt-1 text-sm text-muted-foreground">{run.error ?? "—"}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExecutionTimeline
                  steps={run.steps.map((step) => ({
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

                <div className="space-y-3">
                  {run.steps.map((step) => {
                    const stepStatus = translateStepStatus(step.status);

                    return (
                      <div key={step.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              Step {step.stepIndex + 1}. <span className="font-mono">{step.stepType}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(step.startedAt)} {"->"} {formatDate(step.finishedAt)}
                            </p>
                          </div>
                          <Badge variant={stepStatus.variant}>{stepStatus.label}</Badge>
                        </div>

                        {step.error ? (
                          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{step.error}</div>
                        ) : null}

                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs uppercase text-muted-foreground">Input JSON</p>
                            <JsonView value={step.inputJson} emptyLabel="No input data" />
                          </div>
                          <div>
                            <p className="mb-2 text-xs uppercase text-muted-foreground">Output JSON</p>
                            <JsonView value={step.outputJson} emptyLabel="No output data" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase text-muted-foreground">Context JSON</p>
                  <JsonView value={run.contextJson} emptyLabel="Context was not saved" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
