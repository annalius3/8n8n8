import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RunNowButton } from "@/components/run-now-button";
import { SchedulerTickButton } from "@/components/scheduler-tick-button";
import { FlowToggleButton } from "@/components/flow-toggle-button";

export default async function FlowsPage() {
  const user = await requireUser();

  const flows = await prisma.flow.findMany({
    where: { userId: user.id },
    include: { schedule: true, steps: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Потоки</CardTitle>
          <div className="flex items-center gap-2">
            <SchedulerTickButton />
            <Link href="/flows/new">
              <Button>Создать поток</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Cron</TableHead>
                <TableHead>Следующий запуск</TableHead>
                <TableHead>Шаги</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell>
                    <Link href={`/flows/${flow.id}`} className="font-medium underline-offset-4 hover:underline">
                      {flow.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {flow.isEnabled ? <Badge>включен</Badge> : <Badge variant="secondary">выключен</Badge>}
                  </TableCell>
                  <TableCell>{flow.schedule?.cron ?? "-"}</TableCell>
                  <TableCell>{flow.schedule?.nextRunAt?.toLocaleString() ?? "-"}</TableCell>
                  <TableCell>{flow.steps.length}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <RunNowButton flowId={flow.id} />
                      <FlowToggleButton flowId={flow.id} initialEnabled={flow.isEnabled} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {flows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>Потоков пока нет.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
