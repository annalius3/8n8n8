import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
        <CardTitle>Run Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Flow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.startedAt.toLocaleString()}</TableCell>
                <TableCell>{run.flow.name}</TableCell>
                <TableCell>
                  <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                </TableCell>
                <TableCell>{run.error ?? "-"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {run.steps.map((step) => (
                      <div key={step.id} className="text-xs">
                        #{step.stepIndex + 1} {step.stepType} - {step.status}
                        {step.error ? ` (${step.error})` : ""}
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No runs yet.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
