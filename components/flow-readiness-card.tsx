import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FlowReadinessCardProps = {
  blockers: string[];
  hints: string[];
};

export function FlowReadinessCard({ blockers, hints }: FlowReadinessCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Почему поток может не сработать</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {blockers.length > 0 ? (
            blockers.map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))
          ) : (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Критичных блокеров не найдено. Поток готов к запуску в текущем режиме.</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {hints.map((item) => (
            <div key={item} className="rounded-lg border p-3 text-sm text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
