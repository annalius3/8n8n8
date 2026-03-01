"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExecutionTimeline } from "@/components/execution-timeline";

function translateQueueStatus(status: string) {
  if (status === "pending") return "Ожидает";
  if (status === "generating") return "Генерируется";
  if (status === "ready") return "Готово";
  if (status === "publishing") return "Публикуется";
  if (status === "published") return "Опубликовано";
  if (status === "failed") return "Ошибка";
  if (status === "processing") return "Обрабатывается";
  return status;
}

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

type ActionResponse = {
  count?: number;
  processed?: number;
  generated?: number;
  published?: number;
  updated?: number;
  deleted?: number;
  error?: string;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as ActionResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось выполнить запрос");
  }
  return data;
}

function getSuccessMessage(action: string, data: ActionResponse) {
  if (action === "plan") return `Расписание обновлено для ${data.count ?? 0} элементов.`;
  if (action === "generate-all") {
    if ((data.generated ?? 0) === 0 && (data.published ?? 0) === 0) {
      return "Для автогенерации сейчас нет подходящих элементов: очередь уже обработана или пуста.";
    }
    return `Обработано ${data.generated ?? 0} элементов: сгенерировано 3/меньше и опубликовано ${data.published ?? 0}.`;
  }
  if (action === "generate-selected") {
    return `Контент и изображения обновлены для ${data.processed ?? 0} элементов.`;
  }
  if (action === "publish-selected" || action === "publish-due") {
    return `Опубликовано ${data.processed ?? 0} элементов.`;
  }
  if (action === "retry") {
    if ((data.updated ?? 0) === 0) {
      return "Элементов со статусом «Ошибка» для повторного запуска не найдено.";
    }
    return `Повторно подготовлено ${data.updated ?? 0} элементов.`;
  }
  if (action === "delete") return `Удалено ${data.deleted ?? 0} элементов.`;
  return "Действие выполнено.";
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
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

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

  const allIds = initialItems.map((item) => item.id);
  const failedIds = initialItems.filter((item) => item.status === "failed").map((item) => item.id);
  const readyIds = initialItems.filter((item) => item.status === "ready").map((item) => item.id);
  const selectedReadyIds = selectedIds.filter((id) => readyIds.includes(id));
  const selectedFailedIds = selectedIds.filter((id) => failedIds.includes(id));
  const criticalErrors = useMemo(() => {
    const messages = new Set<string>();

    if (error) {
      messages.add(error);
    }

    for (const item of initialItems) {
      if (item.error) {
        messages.add(item.error);
      }
    }

    for (const run of initialRuns) {
      if (run.status === "failed" && run.error) {
        messages.add(run.error);
      }

      for (const step of run.steps) {
        if (step.status === "failed" && step.error) {
          messages.add(step.error);
        }
      }
    }

    return Array.from(messages).map((message) => {
      if (message.includes("Missing: ['boards:write', 'pins:write']")) {
        return "Pinterest token не имеет прав на публикацию. Нужны scopes boards:write и pins:write.";
      }
      return message;
    });
  }, [error, initialItems, initialRuns]);

  const debugLogText = useMemo(() => {
    const lines: string[] = [];

    if (error) {
      lines.push(`UI_ERROR: ${error}`);
      lines.push("");
    }

    for (const item of initialItems) {
      if (!item.error && item.status !== "failed") continue;
      lines.push(`[QUEUE ITEM] ${item.id}`);
      lines.push(`status: ${item.status}`);
      lines.push(`topic: ${item.topicText ?? "—"}`);
      lines.push(`title: ${item.title || "—"}`);
      lines.push(`scheduled_at: ${item.scheduledAt ?? "—"}`);
      lines.push(`published_at: ${item.publishedAt ?? "—"}`);
      lines.push(`error: ${item.error ?? "—"}`);
      lines.push("");
    }

    for (const run of initialRuns.slice(0, 20)) {
      lines.push(`[RUN] ${run.id}`);
      lines.push(`queue_item_id: ${run.queueItemId ?? "—"}`);
      lines.push(`status: ${run.status}`);
      lines.push(`started_at: ${run.startedAt}`);
      lines.push(`error: ${run.error ?? "—"}`);
      for (const step of run.steps) {
        lines.push(`  - step: ${step.stepType}`);
        lines.push(`    status: ${step.status}`);
        lines.push(`    error: ${step.error ?? "—"}`);
        if (step.outputJson) {
          lines.push(`    output: ${JSON.stringify(step.outputJson)}`);
        }
      }
      lines.push("");
    }

    return lines.join("\n").trim() || "Логов пока нет.";
  }, [error, initialItems, initialRuns]);

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectIds(ids: string[]) {
    setSelectedIds(ids);
  }

  async function copyDebugLogs() {
    try {
      await navigator.clipboard.writeText(debugLogText);
      setCopyState("done");
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  async function perform(action: string, handler: () => Promise<ActionResponse>) {
    setLoading(action);
    setError(null);
    setSuccess(null);
    try {
      const result = await handler();
      setSuccess(getSuccessMessage(action, result));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось выполнить запрос");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Очередь / Конвейер контента</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => selectIds(readyIds)} disabled={loading !== null || readyIds.length === 0}>
              Выбрать готовые
            </Button>
            <Button type="button" variant="outline" onClick={() => selectIds(failedIds)} disabled={loading !== null || failedIds.length === 0}>
              Выбрать ошибки
            </Button>
            <Button type="button" variant="outline" onClick={() => selectIds([])} disabled={loading !== null || selectedIds.length === 0}>
              Снять выбор
            </Button>
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
              onClick={() => perform("generate-all", () => postJson(`/api/flows/${flowId}/queue/generate`, { autoPipeline: true }))}
              disabled={loading !== null || allIds.length === 0}
            >
              Сгенерировать 3 и опубликовать 1
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("generate-selected", () => postJson(`/api/flows/${flowId}/queue/generate`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Сгенерировать текст и изображение
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedReadyIds.length === 0) {
                  setError("Для публикации нужно выбрать элементы со статусом «Готово».");
                  setSuccess(null);
                  return;
                }
                void perform("publish-selected", () => postJson(`/api/flows/${flowId}/queue/publish`, { queueItemIds: selectedReadyIds }));
              }}
              disabled={loading !== null || selectedReadyIds.length === 0}
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
              onClick={() =>
                perform("retry", () =>
                  postJson(`/api/flows/${flowId}/queue/retry`, {
                    queueItemIds: selectedFailedIds.length > 0 ? selectedFailedIds : failedIds
                  })
                )
              }
              disabled={loading !== null || failedIds.length === 0}
            >
              Повторить с ошибкой
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
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <p className="text-sm text-muted-foreground">
            Для публикации выбирайте только элементы со статусом <span className="font-medium">Готово</span>. Сейчас выбрано готовых: {selectedReadyIds.length}.
          </p>
        </CardContent>
      </Card>

      {criticalErrors.length > 0 ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardHeader>
            <CardTitle className="text-red-700">Критические ошибки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-700">
            {criticalErrors.map((message) => (
              <div key={message} className="rounded-md border border-red-200 bg-white/80 p-3">
                {message}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3"></th>
              <th className="w-28 p-3">Статус</th>
              <th className="w-48 p-3">Тема</th>
              <th className="w-48 p-3">Заголовок</th>
              <th className="w-[340px] p-3">Описание</th>
              <th className="w-28 p-3">Изображение</th>
              <th className="w-40 p-3">Запланировано</th>
              <th className="w-40 p-3">Опубликовано</th>
              <th className="w-52 p-3">Ошибка</th>
              <th className="p-3">Логи</th>
            </tr>
          </thead>
          <tbody>
            {initialItems.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-t align-top">
                  <td className="p-3">
                    <label className="flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
                    </label>
                  </td>
                  <td className="p-3">
                    <Badge variant={item.status === "failed" ? "destructive" : item.status === "published" ? "default" : "outline"}>
                      {translateQueueStatus(item.status)}
                    </Badge>
                  </td>
                  <td className="p-3">{item.topicText ?? "—"}</td>
                  <td className="p-3">{item.title || "—"}</td>
                  <td className="p-3">
                    <div className="max-w-[320px] overflow-hidden whitespace-pre-wrap break-words text-muted-foreground">
                      {item.body || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-20 w-20 rounded-md object-cover" /> : "—"}
                  </td>
                  <td className="p-3">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3">{item.publishedAt ? new Date(item.publishedAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3 text-red-600">
                    <div className="max-w-[200px] break-words">{item.error ?? "—"}</div>
                  </td>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Диагностика и логи для копирования</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={copyDebugLogs}>
            {copyState === "done" ? "Скопировано" : copyState === "error" ? "Не удалось скопировать" : "Копировать логи"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Если после кнопки генерации, публикации или повтора возникла ошибка, скопируйте этот блок и отправьте его целиком.
          </p>
          <textarea
            readOnly
            value={debugLogText}
            className="min-h-[320px] w-full rounded-lg border bg-muted/20 p-3 font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}
