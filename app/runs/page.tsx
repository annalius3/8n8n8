import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function translateRunStatus(status: string) {
  if (status === "failed") return "ошибка";
  if (status === "success") return "успех";
  if (status === "running") return "выполняется";
  return status;
}

function translateStepStatus(status: string) {
  if (status === "failed") return "ошибка";
  if (status === "success") return "успех";
  if (status === "skipped") return "пропущен";
  return status;
}

export default async function RunsPage() {
  const user = await requireUser();

  const runs = await prisma.jobRun.findMany({
    where: {
      flow: {
        userId: user.id
      }
    },
    include: {
      flow: true,
      steps: {
        orderBy: {
          stepIndex: "asc"
        }
      }
    },
    orderBy: {
      startedAt: "desc"
    },
    take: 100
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Логи запусков</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Запуск</TableHead>
              <TableHead>Поток</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Ошибка</TableHead>
              <TableHead>Шаги</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.startedAt.toLocaleString()}</TableCell>
                <TableCell>{run.flow.name}</TableCell>
                <TableCell>
                  <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
                    {translateRunStatus(run.status)}
                  </Badge>
                </TableCell>
                <TableCell>{run.error ?? "-"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {run.steps.map((step) => (
                      <div key={step.id} className="text-xs">
                        #{step.stepIndex + 1} {step.stepType} - {translateStepStatus(step.status)}
                        {step.error ? ` (${step.error})` : ""}
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Запусков пока не было.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
