import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { TopicSuggestionsManager } from "@/components/topic-suggestions-manager";
import { LinkButton } from "@/components/ui/link-button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FlowTopicsPage({ params }: Props) {
  const user = await requireUser("/flows");
  const { id } = await params;

  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      topicSuggestions: {
        orderBy: { createdAt: "asc" }
      },
      runs: {
        where: {
          queueItemId: null
        },
        orderBy: { startedAt: "desc" },
        take: 10,
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
        <LinkButton href="/flows" variant="outline">К списку кампаний</LinkButton>
        <LinkButton href={`/flows/${flow.id}`} variant="outline">Обзор</LinkButton>
        <LinkButton href={`/flows/${flow.id}/queue`} variant="outline">Очередь</LinkButton>
      </div>
      <TopicSuggestionsManager
        flowId={flow.id}
        initialSuggestions={flow.topicSuggestions.map((item) => ({
          id: item.id,
          topicText: item.topicText,
          selected: item.selected
        }))}
        initialRuns={flow.runs.map((run) => ({
          id: run.id,
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
