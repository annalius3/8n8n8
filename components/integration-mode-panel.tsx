import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIntegrationModeLabel, type IntegrationModes } from "@/lib/integrations/runtime";

type IntegrationModePanelProps = {
  modes: IntegrationModes;
};

const ITEMS: Array<{ key: keyof IntegrationModes; label: string; note: string }> = [
  { key: "openai", label: "OpenAI", note: "Text generation in the template step" },
  { key: "leonardo", label: "Leonardo", note: "Image generation" },
  { key: "pinterest", label: "Pinterest", note: "Publishing through the user's saved server-side token and flow board_id" },
  { key: "telegram", label: "Telegram", note: "Publication notifications after successful publish" },
  { key: "r2", label: "Cloudflare R2", note: "Image storage" }
];

export function IntegrationModePanel({ modes }: IntegrationModePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {ITEMS.map((item) => {
          const mode = modes[item.key];

          return (
            <div key={item.key} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{item.label}</p>
                <Badge variant={mode === "real" ? "default" : mode === "connection_required" ? "outline" : "secondary"}>
                  {getIntegrationModeLabel(mode)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

