import { Badge } from "@/components/ui/badge";

type TimelineStep = {
  id: string;
  label: string;
  status: "success" | "failed" | "skipped" | "running";
  mode?: string | null;
  error?: string | null;
};

type ExecutionTimelineProps = {
  steps: TimelineStep[];
};

function getStatusColors(status: TimelineStep["status"]) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "running") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getStatusLabel(status: TimelineStep["status"]) {
  if (status === "success") return "Успех";
  if (status === "failed") return "Ошибка";
  if (status === "running") return "Выполняется";
  return "Пропущен";
}

function getModeLabel(mode: string | null | undefined) {
  if (!mode) return null;
  if (mode === "real") return "Реальный API";
  if (mode === "template") return "Шаблон";
  if (mode === "connection_required") return "Нужен токен";
  if (mode === "openai") return "OpenAI";
  return mode;
}

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">Шаги ещё не выполнялись.</p>;
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${getStatusColors(step.status)}`}>
              {index + 1}
            </div>
            {index < steps.length - 1 ? <div className="mt-2 h-full min-h-6 w-px bg-border" /> : null}
          </div>
          <div className="flex-1 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{step.label}</p>
              <Badge variant={step.status === "failed" ? "destructive" : step.status === "skipped" ? "outline" : "secondary"}>
                {getStatusLabel(step.status)}
              </Badge>
              {getModeLabel(step.mode) ? <Badge variant="outline">{getModeLabel(step.mode)}</Badge> : null}
            </div>
            {step.error ? <p className="mt-2 text-sm text-red-700">{step.error}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
