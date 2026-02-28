import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SourcePreviewCardProps = {
  sourceType: "rss" | "queue" | "unknown";
  sourceLabel: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
};

export function SourcePreviewCard({ sourceType, sourceLabel, summary, details }: SourcePreviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Source preview</CardTitle>
          <Badge variant="outline">{sourceType === "rss" ? "RSS" : sourceType === "queue" ? "Queue" : "Не определён"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">{sourceLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
              <p className="mt-1 break-all text-sm">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
