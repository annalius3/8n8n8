import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { CampaignQueueManager } from "@/components/campaign-queue-manager";
import { LinkButton } from "@/components/ui/link-button";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ autostart?: string }>;
};

export default async function FlowQueuePage({ params, searchParams }: Props) {
  const user = await requireUser("/flows");
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      queueItems: {
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
      },
      runs: {
        orderBy: { startedAt: "desc" },
        include: {
          steps: {
            orderBy: { stepIndex: "asc" }
          }
        }
      }
    }
  });

  if (!flow) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/flows" variant="outline">К списку потоков</LinkButton>
        <LinkButton href={`/flows/${flow.id}`} variant="outline">Обзор</LinkButton>
        <LinkButton href={`/flows/${flow.id}/topics`} variant="outline">Темы</LinkButton>
      </div>
      <CampaignQueueManager
        flowId={flow.id}
        autoStartGenerate={resolvedSearchParams?.autostart === "1"}
        initialItems={flow.queueItems.map((item) => ({
          id: item.id,
          status: item.status,
          topicText: item.topicText,
          title: item.title,
          body: item.body,
          imageUrl: item.imageUrl,
          scheduledAt: item.scheduledAt?.toISOString() ?? null,
          publishedAt: item.publishedAt?.toISOString() ?? null,
          error: item.error
        }))}
        initialRuns={flow.runs.map((run) => ({
          id: run.id,
          queueItemId: run.queueItemId,
          status: run.status,
          startedAt: run.startedAt.toISOString(),
          error: run.error,
          steps: run.steps.map((step) => ({
            id: step.id,
            stepType: step.stepType,
            status: step.status,
            error: step.error,
            outputJson: step.outputJson as Record<string, unknown> | null
          }))
        }))}
      />
    </div>
  );
}

