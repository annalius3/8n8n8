"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function isTopicGenerationRun(run: Run) {
  return run.steps.some((step) => step.stepType === "topic_generation");
}

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
  const generationStartedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [runs, setRuns] = useState(initialRuns.filter(isTopicGenerationRun));
  const [selectedIds, setSelectedIds] = useState(initialSuggestions.filter((item) => item.selected).map((item) => item.id));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suggestions;
    return suggestions.filter((item) => item.topicText.toLowerCase().includes(normalized));
  }, [suggestions, query]);

  useEffect(() => {
    setSelectedIds((current) => suggestions.filter((item) => item.selected || current.includes(item.id)).map((item) => item.id));
  }, [suggestions]);

  async function refreshData() {
    const [topicsResponse, runsResponse] = await Promise.all([
      fetch(`/api/flows/${flowId}/topics`, { cache: "no-store" }),
      fetch(`/api/flows/${flowId}/runs`, { cache: "no-store" })
    ]);

    const topicsData = (await topicsResponse.json().catch(() => ({}))) as {
      suggestions?: TopicSuggestion[];
      error?: string;
    };
    const runsData = (await runsResponse.json().catch(() => ({}))) as {
      runs?: Run[];
      error?: string;
    };

    if (!topicsResponse.ok) {
      throw new Error(topicsData.error ?? "Не удалось обновить темы");
    }

    if (!runsResponse.ok) {
      throw new Error(runsData.error ?? "Не удалось обновить логи запуска");
    }

    const nextSuggestions = topicsData.suggestions ?? [];
    const nextRuns = (runsData.runs ?? []).filter(isTopicGenerationRun);

    setSuggestions(nextSuggestions);
    setRuns(nextRuns);

    return {
      suggestions: nextSuggestions,
      runs: nextRuns
    };
  }

  async function startGeneration() {
    if (generationStartedRef.current || generating) return;

    generationStartedRef.current = true;
    setGenerating(true);
    setError(null);

    const poll = window.setInterval(async () => {
      try {
        const data = await refreshData();
        const latestRun = data.runs[0];
        if (data.suggestions.length > 0 || (latestRun && latestRun.status !== "running")) {
          window.clearInterval(poll);
          setGenerating(false);
        }
      } catch {
        window.clearInterval(poll);
        setGenerating(false);
      }
    }, 2000);

    try {
      const response = await fetch(`/api/flows/${flowId}/topics/generate`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось запустить генерацию тем");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить генерацию тем");
    } finally {
      window.clearInterval(poll);
      generationStartedRef.current = false;
      setGenerating(false);
      await refreshData().catch(() => undefined);
      router.refresh();
    }
  }

  useEffect(() => {
    const latestRun = runs[0];
    if (suggestions.length === 0 && !latestRun && !generationStartedRef.current) {
      void startGeneration();
    }
  }, [runs, suggestions.length]);

  useEffect(() => {
    const latestRun = runs[0];
    if (latestRun?.status !== "running") return;

    setGenerating(true);
    const poll = window.setInterval(async () => {
      try {
        const data = await refreshData();
        const currentRun = data.runs[0];
        if (data.suggestions.length > 0 || !currentRun || currentRun.status !== "running") {
          window.clearInterval(poll);
          setGenerating(false);
          router.refresh();
        }
      } catch {
        window.clearInterval(poll);
        setGenerating(false);
      }
    }, 2000);

    return () => {
      window.clearInterval(poll);
    };
  }, [runs, router, suggestions.length]);

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

  const lastRun = runs[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Шаг 2. Проверка 50 тем</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {generating ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Генерация тем идёт. Список тем и логи запуска обновляются автоматически.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по темам" />
            <Button type="button" variant="outline" onClick={() => setSelectedIds(filtered.map((item) => item.id))} disabled={generating || filtered.length === 0}>
              Выбрать все
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelectedIds([])} disabled={generating || selectedIds.length === 0}>
              Снять выбор
            </Button>
          </div>

          <div className="max-h-[520px] space-y-2 overflow-auto rounded-xl border p-3">
            {filtered.length > 0 ? (
              filtered.map((item, index) => (
                <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} disabled={generating} />
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <span>{item.topicText}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {generating ? "Темы ещё генерируются..." : "Тем пока нет. Нажмите «Запустить генерацию», чтобы получить 50 тем."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={generating} onClick={() => void startGeneration()}>
              {generating ? "Генерация..." : "Запустить генерацию"}
            </Button>
            <Button type="button" disabled={loading || selectedIds.length === 0 || generating} onClick={addSelectedToQueue}>
              {loading ? "Добавление..." : "Добавить выбранные в очередь"}
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
                <p>ID запуска: {lastRun.id}</p>
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
