import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { RunNowButton } from "@/components/run-now-button";
import { FlowEditor } from "@/components/flow-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FlowEditorPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      schedule: true,
      steps: { orderBy: { orderIndex: "asc" } }
    }
  });

  if (!flow || !flow.schedule) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/flows">
          <Button variant="outline">Назад к потокам</Button>
        </Link>
        <RunNowButton flowId={flow.id} />
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
    </div>
  );
}
