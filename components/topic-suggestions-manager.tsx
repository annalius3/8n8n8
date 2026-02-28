"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExecutionTimeline } from "@/components/execution-timeline";

type TopicSuggestion = {
  id: string;
  topicText: string;
  selected: boolean;
};

type RunStep = {
  id: string;
  stepType: string;
  status: "success" | "failed" | "skipped" | "running";
  error: string | null;
  outputJson?: Record<string, unknown> | null;
};

type Run = {
  id: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  error: string | null;
  steps: RunStep[];
};

export function TopicSuggestionsManager({
  flowId,
  initialSuggestions,
  initialRuns
}: {
  flowId: string;
  initialSuggestions: TopicSuggestion[];
  initialRuns: Run[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSuggestions.filter((item) => item.selected).map((item) => item.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialSuggestions;
    return initialSuggestions.filter((item) => item.topicText.toLowerCase().includes(normalized));
  }, [initialSuggestions, query]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function addSelectedToQueue() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}/topics/add-to-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds: selectedIds })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось добавить темы в очередь");
      }

      router.push(`/flows/${flowId}/queue`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось добавить темы в очередь");
    } finally {
      setLoading(false);
    }
  }

  const lastRun = initialRuns[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Шаг 2. Просмотр 50 тем</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по темам" />
            <Button type="button" variant="outline" onClick={() => setSelectedIds(filtered.map((item) => item.id))}>
              Выбрать все
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelectedIds([])}>
              Снять выбор
            </Button>
          </div>

          <div className="max-h-[520px] space-y-2 overflow-auto rounded-xl border p-3">
            {filtered.map((item, index) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} />
                <span className="text-muted-foreground">{index + 1}.</span>
                <span>{item.topicText}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={loading || selectedIds.length === 0} onClick={addSelectedToQueue}>
              {loading ? "Добавляю..." : "Добавить выбранные в очередь"}
            </Button>
            <span className="text-sm text-muted-foreground">Выбрано: {selectedIds.length}</span>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последний запуск генерации тем</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastRun ? (
            <>
              <div className="rounded-lg border p-3 text-sm">
                <p>Run ID: {lastRun.id}</p>
                <p className="text-muted-foreground">Статус: {lastRun.status}</p>
                <p className="text-muted-foreground">Старт: {new Date(lastRun.startedAt).toLocaleString("ru-RU")}</p>
                {lastRun.error ? <p className="mt-2 text-red-600">{lastRun.error}</p> : null}
              </div>
              <ExecutionTimeline
                steps={lastRun.steps.map((step, index) => ({
                  id: step.id,
                  label: step.stepType || `step_${index}`,
                  status: step.status,
                  error: step.error,
                  mode: typeof step.outputJson?.mode === "string" ? String(step.outputJson.mode) : null
                }))}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Логи появятся после первого запуска генерации тем.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
