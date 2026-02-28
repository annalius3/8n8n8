"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExecutionTimeline } from "@/components/execution-timeline";

type QueueItem = {
  id: string;
  status: string;
  topicText: string | null;
  title: string;
  body: string;
  imageUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
};

type Run = {
  id: string;
  queueItemId: string | null;
  status: "success" | "failed" | "running";
  startedAt: string;
  error: string | null;
  steps: Array<{
    id: string;
    stepType: string;
    status: "success" | "failed" | "skipped" | "running";
    error: string | null;
    outputJson?: Record<string, unknown> | null;
  }>;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось выполнить запрос");
  }
}

export function CampaignQueueManager({
  flowId,
  initialItems,
  initialRuns
}: {
  flowId: string;
  initialItems: QueueItem[];
  initialRuns: Run[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const runsByItem = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of initialRuns) {
      if (!run.queueItemId) continue;
      const bucket = map.get(run.queueItemId) ?? [];
      bucket.push(run);
      map.set(run.queueItemId, bucket);
    }
    return map;
  }, [initialRuns]);

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function perform(action: string, handler: () => Promise<void>) {
    setLoading(action);
    setError(null);
    try {
      await handler();
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось выполнить запрос");
    } finally {
      setLoading(null);
    }
  }

  const allIds = initialItems.map((item) => item.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Очередь / Конвейер контента</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("plan", () => postJson(`/api/flows/${flowId}/queue/plan-schedule`, {}))}
              disabled={loading !== null}
            >
              Спланировать расписание
            </Button>
            <Button
              type="button"
              onClick={() => perform("generate-all", () => postJson(`/api/flows/${flowId}/queue/generate`, { queueItemIds: allIds }))}
              disabled={loading !== null || allIds.length === 0}
            >
              Сгенерировать всё
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("generate-selected", () => postJson(`/api/flows/${flowId}/queue/generate`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Generate text + image
            </Button>
            <Button
              type="button"
              onClick={() => perform("publish-selected", () => postJson(`/api/flows/${flowId}/queue/publish`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Опубликовать выбранные
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("publish-due", () => postJson(`/api/flows/${flowId}/queue/publish`, { dueOnly: true }))}
              disabled={loading !== null}
            >
              Опубликовать запланированные
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("retry", () => postJson(`/api/flows/${flowId}/queue/retry`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Повторить failed
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => perform("delete", () => postJson(`/api/flows/${flowId}/queue/delete`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Удалить выбранные
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3"></th>
              <th className="p-3">Статус</th>
              <th className="p-3">Тема</th>
              <th className="p-3">Заголовок</th>
              <th className="p-3">Описание</th>
              <th className="p-3">Изображение</th>
              <th className="p-3">scheduled_at</th>
              <th className="p-3">published_at</th>
              <th className="p-3">Ошибка</th>
              <th className="p-3">Логи</th>
            </tr>
          </thead>
          <tbody>
            {initialItems.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-t align-top">
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} />
                  </td>
                  <td className="p-3">
                    <Badge variant={item.status === "failed" ? "destructive" : item.status === "published" ? "default" : "outline"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-3">{item.topicText ?? "—"}</td>
                  <td className="p-3">{item.title || "—"}</td>
                  <td className="p-3">
                    <div className="max-w-sm whitespace-pre-wrap text-muted-foreground">{item.body || "—"}</div>
                  </td>
                  <td className="p-3">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-20 w-20 rounded-md object-cover" /> : "—"}
                  </td>
                  <td className="p-3">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3">{item.publishedAt ? new Date(item.publishedAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3 text-red-600">{item.error ?? "—"}</td>
                  <td className="p-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
                      Показать логи
                    </Button>
                  </td>
                </tr>
                {expandedItemId === item.id ? (
                  <tr className="border-t bg-muted/20">
                    <td colSpan={10} className="p-4">
                      <div className="space-y-4">
                        {(runsByItem.get(item.id) ?? []).length > 0 ? (
                          (runsByItem.get(item.id) ?? []).map((run) => (
                            <Card key={run.id}>
                              <CardHeader>
                                <CardTitle className="text-base">
                                  Run {run.id} · {new Date(run.startedAt).toLocaleString("ru-RU")}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ExecutionTimeline
                                  steps={run.steps.map((step) => ({
                                    id: step.id,
                                    label: step.stepType,
                                    status: step.status,
                                    error: step.error,
                                    mode: typeof step.outputJson?.mode === "string" ? String(step.outputJson.mode) : null
                                  }))}
                                />
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">Для этого элемента пока нет логов.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
