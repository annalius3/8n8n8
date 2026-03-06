"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ExecutionTimeline } from "@/components/execution-timeline";

function translateQueueStatus(status: string, scheduledAt: string | null) {
  const now = Date.now();
  const isDue = scheduledAt ? new Date(scheduledAt).getTime() <= now : false;
  if (status === "pending") return "В ожидании";
  if (status === "generating") return "Генерация";
  if (status === "ready") return isDue ? "К публикации" : "Готово";
  if (status === "publishing") return "Публикация";
  if (status === "published") return "Опубликовано";
  if (status === "failed") return "Ошибка";
  if (status === "processing") return "Обработка";
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

type QueueScheduleMode = "interval_hours" | "random_daily" | "hourly";

type QueueSnapshot = {
  queueItems: QueueItem[];
  runs: Run[];
  diagnostics?: QueueDiagnostics;
};

type QueueDiagnostics = {
  checkedAt: string;
  flowEnabled: boolean;
  autopublishEnabled: boolean;
  schedulePaused: boolean;
  scheduleCron: string | null;
  scheduleLastRunAt: string | null;
  scheduleNextRunAt: string | null;
  schedulerStale: boolean;
  dueItemId: string | null;
  dueItemStatus: string | null;
  dueItemScheduledAt: string | null;
  blockedReason: string | null;
  latestPublishError: string | null;
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

async function getQueueSnapshot(flowId: string) {
  const response = await fetch(`/api/flows/${flowId}/queue`, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as QueueSnapshot & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Не удалось обновить очередь");
  }
  return data;
}

function getSuccessMessage(action: string, data: ActionResponse) {
  if (action === "plan") return `Расписание обновлено для ${data.count ?? 0} элементов.`;
  if (action === "plan-hourly") return `Поставлено почасовое расписание для ${data.count ?? 0} элементов.`;
  if (action === "plan-custom") return `Новое расписание применено для ${data.count ?? 0} элементов.`;
  if (action === "generate-all") {
    if ((data.generated ?? 0) === 0 && (data.published ?? 0) === 0) {
      return "Сейчас нет подходящих элементов для автогенерации. Очередь пуста или уже обработана.";
    }
    return `Обработано ${data.generated ?? 0} элементов: подготовлено до 10 и опубликовано ${data.published ?? 0}.`;
  }
  if (action === "generate-selected") {
    return `Текст и изображения обновлены для ${data.processed ?? 0} элементов.`;
  }
  if (action === "publish-selected" || action === "publish-due") {
    return `Опубликовано ${data.processed ?? 0} элементов.`;
  }
  if (action === "retry") {
    if ((data.updated ?? 0) === 0) {
      return "Элементы с ошибкой для повтора не найдены.";
    }
    return `Подготовлено к повтору ${data.updated ?? 0} элементов.`;
  }
  if (action === "delete") return `Удалено ${data.deleted ?? 0} элементов.`;
  return "Действие выполнено.";
}

export function CampaignQueueManager({
  flowId,
  bootstrapFromSeed = false,
  autoStartGenerate = false,
  initialTimezone,
  initialStartTime,
  initialDiagnostics,
  initialItems,
  initialRuns
}: {
  flowId: string;
  bootstrapFromSeed?: boolean;
  autoStartGenerate?: boolean;
  initialTimezone: string;
  initialStartTime: string;
  initialDiagnostics: QueueDiagnostics;
  initialItems: QueueItem[];
  initialRuns: Run[];
}) {
  const router = useRouter();
  const bootstrapRef = useRef(false);
  const autoPipelineRef = useRef(false);
  const [items, setItems] = useState(initialItems);
  const [runs, setRuns] = useState(initialRuns);
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "generating" | "ready" | "failed" | "published">("all");
  const [scheduleMode, setScheduleMode] = useState<QueueScheduleMode>("interval_hours");
  const [intervalHours, setIntervalHours] = useState(1);
  const [scheduleStartTime, setScheduleStartTime] = useState(initialStartTime || "09:00");
  const [scheduleTimezone, setScheduleTimezone] = useState(initialTimezone || "Europe/Kiev");
  const waitingNextWindow = !diagnostics.blockedReason && !diagnostics.dueItemId;

  useEffect(() => {
    const cron = diagnostics.scheduleCron ?? "";
    if (cron === "random_daily") {
      setScheduleMode("random_daily");
      return;
    }

    const hourlyMatch = cron.match(/^(\d+)\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
    if (hourlyMatch) {
      setScheduleMode("interval_hours");
      setIntervalHours(Math.max(1, Math.min(24, Number(hourlyMatch[2]) || 1)));
    }
  }, [diagnostics.scheduleCron]);

  const runsByItem = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of runs) {
      if (!run.queueItemId) continue;
      const bucket = map.get(run.queueItemId) ?? [];
      bucket.push(run);
      map.set(run.queueItemId, bucket);
    }
    return map;
  }, [runs]);

  const failedIds = items.filter((item) => item.status === "failed").map((item) => item.id);
  const readyIds = items.filter((item) => item.status === "ready").map((item) => item.id);
  const pendingIds = items.filter((item) => item.status === "pending").map((item) => item.id);
  const generatedCount = items.filter((item) => item.status === "ready" || item.status === "published" || item.status === "publishing").length;
  const activeCount = items.filter((item) => item.status === "generating" || item.status === "publishing").length;
  const selectedReadyIds = selectedIds.filter((id) => readyIds.includes(id));
  const selectedFailedIds = selectedIds.filter((id) => failedIds.includes(id));
  const runningRuns = runs.filter((run) => run.status === "running").length;
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const filterMatch = filter === "all" ? true : item.status === filter;
      if (!filterMatch) return false;
      if (!normalizedSearch) return true;
      const haystack = [item.topicText, item.title, item.body, item.error].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [items, filter, search]);
  const visibleIds = visibleItems.map((item) => item.id);
  const allSelected = visibleItems.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const criticalErrors = useMemo(() => {
    const messages = new Set<string>();

    if (error) messages.add(error);
    for (const item of items) {
      if (item.error) messages.add(item.error);
    }
    for (const run of runs) {
      if (run.status === "failed" && run.error) messages.add(run.error);
      for (const step of run.steps) {
        if (step.status === "failed" && step.error) messages.add(step.error);
      }
    }

    return Array.from(messages).map((message) => {
      const codeMatch = message.match(/\[(PINTEREST_[A-Z0-9_]+)\]/);
      const codeSuffix = codeMatch ? ` (код: ${codeMatch[1]})` : "";

      if (message.includes("Missing: ['boards:write', 'pins:write']")) {
        return `У Pinterest-токена нет прав на публикацию. Нужны scopes: boards:write и pins:write.${codeSuffix}`;
      }
      if (message.includes("[PINTEREST_API_401]")) {
        return `Pinterest отклонил токен. Переподключите Pinterest и проверьте scopes boards:write и pins:write.${codeSuffix}`;
      }
      if (message.includes("[PINTEREST_CONNECTION_NOT_CONFIGURED]")) {
        return `Pinterest не подключён. Откройте Connections и подключите аккаунт.${codeSuffix}`;
      }
      if (message.includes("[PINTEREST_BOARD_ID_MISSING]")) {
        return `Не выбрана доска Pinterest. Укажите board_id в настройках потока.${codeSuffix}`;
      }
      if (message.includes("OpenAI request failed: 429") || message.includes("insufficient_quota")) {
        return "OpenAI не дал ответ из-за лимита или отсутствия биллинга. Проверьте квоту и billing.";
      }
      if (message.includes("Leonardo API key is not configured")) {
        return "Не настроен ключ Leonardo. Добавьте его в Settings.";
      }
      return `${message}${codeSuffix}`;
    });
  }, [error, items, runs]);

  const debugLogText = useMemo(() => {
    const lines: string[] = [];

    if (error) {
      lines.push(`UI_ERROR: ${error}`);
      lines.push("");
    }

    for (const item of items) {
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

    for (const run of runs.slice(0, 20)) {
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
  }, [error, items, runs]);

  async function refreshQueue() {
    const snapshot = await getQueueSnapshot(flowId);
    setItems(snapshot.queueItems);
    setRuns(snapshot.runs);
    if (snapshot.diagnostics) {
      setDiagnostics(snapshot.diagnostics);
    }
  }

  async function bootstrapQueueFromSeed() {
    setLoading("bootstrap");
    setProgressMessage("Генерируем темы и автоматически добавляем их в очередь...");
    setError(null);
    setSuccess(null);

    try {
      const generateResponse = await fetch(`/api/flows/${flowId}/topics/generate`, { method: "POST" });
      const generateData = (await generateResponse.json().catch(() => ({}))) as { error?: string };
      if (!generateResponse.ok) {
        throw new Error(generateData.error ?? "Не удалось сгенерировать темы");
      }

      const topicsResponse = await fetch(`/api/flows/${flowId}/topics`, { cache: "no-store" });
      const topicsData = (await topicsResponse.json().catch(() => ({}))) as { suggestions?: Array<{ id: string }>; error?: string };
      if (!topicsResponse.ok || !topicsData.suggestions?.length) {
        throw new Error(topicsData.error ?? "Не удалось получить сгенерированные темы");
      }

      const addResponse = await fetch(`/api/flows/${flowId}/topics/add-to-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds: topicsData.suggestions.map((item) => item.id) })
      });
      const addData = (await addResponse.json().catch(() => ({}))) as { error?: string };
      if (!addResponse.ok) {
        throw new Error(addData.error ?? "Не удалось добавить темы в очередь");
      }

      await refreshQueue();
      setSuccess("Темы сгенерированы и автоматически добавлены в очередь.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось подготовить очередь из исходной темы");
    } finally {
      setLoading(null);
      setProgressMessage(null);
      router.replace(`/flows/${flowId}/queue?autostart=1`);
      router.refresh();
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
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
    setProgressMessage(action === "generate-all" ? "Запущен длинный пайплайн: генерация 10 элементов и публикация первого. Страница будет обновляться автоматически." : "Действие выполняется. Данные обновляются автоматически.");
    setError(null);
    setSuccess(null);
    try {
      const result = await handler();
      setSuccess(getSuccessMessage(action, result));
      await refreshQueue().catch(() => undefined);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось выполнить действие");
      await refreshQueue().catch(() => undefined);
    } finally {
      setLoading(null);
      setProgressMessage(null);
    }
  }

  async function runSchedulerNow() {
    setLoading("scheduler-tick");
    setProgressMessage("Запускаем scheduler вручную...");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/scheduler/tick", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        started?: number;
        due?: number;
        publishedRuns?: number;
        generatedRuns?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось запустить scheduler");
      }

      const started = data.started ?? 0;
      const generated = data.generatedRuns ?? 0;
      const published = data.publishedRuns ?? 0;
      setSuccess(`Scheduler выполнен: flow-запусков ${started}, сгенерировано ${generated}, опубликовано ${published}.`);
      await refreshQueue();
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить scheduler");
    } finally {
      setLoading(null);
      setProgressMessage(null);
    }
  }

  useEffect(() => {
    if (!bootstrapFromSeed || bootstrapRef.current) return;
    if (items.length > 0) return;

    bootstrapRef.current = true;
    void bootstrapQueueFromSeed();
  }, [bootstrapFromSeed, items.length]);

  useEffect(() => {
    if (!autoStartGenerate || loading !== null || activeCount > 0 || runningRuns > 0 || pendingIds.length === 0) return;
    if (autoPipelineRef.current) return;

    autoPipelineRef.current = true;
    void perform("generate-all", () => postJson(`/api/flows/${flowId}/queue/generate`, { autoPipeline: true })).finally(() => {
      autoPipelineRef.current = false;
    });
  }, [autoStartGenerate, flowId, loading, activeCount, runningRuns, pendingIds.length]);

  useEffect(() => {
    if (!loading && activeCount === 0 && runningRuns === 0) return;

    const poll = window.setInterval(() => {
      void refreshQueue().catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(poll);
  }, [loading, activeCount, runningRuns, flowId]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Очередь / Контент-пайплайн</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`rounded-lg border p-3 text-sm ${
              diagnostics.blockedReason
                ? "border-amber-300 bg-amber-50/70"
                : waitingNextWindow
                  ? "border-blue-300 bg-blue-50/70"
                  : "border-emerald-300 bg-emerald-50/70"
            }`}
          >
            <p className="font-medium">
              Диагностика автопубликации: {diagnostics.blockedReason ? "есть блокировка" : waitingNextWindow ? "ожидание следующего окна" : "готово к работе"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Последний тик: {diagnostics.scheduleLastRunAt ? new Date(diagnostics.scheduleLastRunAt).toLocaleString("ru-RU") : "—"} · Следующий тик:{" "}
              {diagnostics.scheduleNextRunAt ? new Date(diagnostics.scheduleNextRunAt).toLocaleString("ru-RU") : "—"} · Cron: {diagnostics.scheduleCron ?? "—"}
            </p>
            <div className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void runSchedulerNow()} disabled={loading !== null}>
                Запустить scheduler сейчас
              </Button>
            </div>
            {diagnostics.blockedReason ? <p className="mt-2 text-sm text-amber-800">Причина: {diagnostics.blockedReason}</p> : null}
            {waitingNextWindow ? <p className="mt-2 text-sm text-blue-800">Сейчас нет просроченных постов. Публикация продолжится автоматически по расписанию.</p> : null}
            {diagnostics.dueItemId ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Просроченный item: {diagnostics.dueItemId} · статус: {diagnostics.dueItemStatus ?? "—"} · время:{" "}
                {diagnostics.dueItemScheduledAt ? new Date(diagnostics.dueItemScheduledAt).toLocaleString("ru-RU") : "—"}
              </p>
            ) : null}
            {diagnostics.latestPublishError ? <p className="mt-2 text-sm text-red-700">Последняя ошибка: {diagnostics.latestPublishError}</p> : null}
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm font-medium">Настройка расписания публикаций</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Выберите человеческий режим: каждые 1/2/3+ часа или хаотично в течение дня. Точное время старта тоже можно задать.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Режим</span>
                <Select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as QueueScheduleMode)}>
                  <option value="interval_hours">Каждые N часов</option>
                  <option value="hourly">Каждый час</option>
                  <option value="random_daily">Хаотично по времени</option>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Интервал (часы)</span>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={intervalHours}
                  disabled={scheduleMode !== "interval_hours"}
                  onChange={(event) => setIntervalHours(Math.max(1, Math.min(24, Number(event.target.value) || 1)))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Старт в</span>
                <Input type="time" value={scheduleStartTime} onChange={(event) => setScheduleStartTime(event.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Часовой пояс</span>
                <Input value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  perform("plan-custom", () =>
                    postJson(`/api/flows/${flowId}/queue/plan-schedule`, {
                      mode: scheduleMode,
                      intervalHours: scheduleMode === "interval_hours" ? intervalHours : undefined,
                      startTime: scheduleStartTime,
                      timezone: scheduleTimezone
                    })
                  )
                }
                disabled={loading !== null}
              >
                Подтвердить и применить
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase text-muted-foreground">В ожидании</p>
              <p className="mt-1 text-lg font-semibold">{pendingIds.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase text-muted-foreground">В работе</p>
              <p className="mt-1 text-lg font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Готово</p>
              <p className="mt-1 text-lg font-semibold">{readyIds.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Ошибок</p>
              <p className="mt-1 text-lg font-semibold">{failedIds.length}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => perform("generate-all", () => postJson(`/api/flows/${flowId}/queue/generate`, { autoPipeline: true }))}
              disabled={loading !== null || (pendingIds.length === 0 && failedIds.length === 0)}
            >
              Запустить автопайплайн
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
                  setError('Сначала выберите элементы со статусом "Готово".');
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

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по теме, заголовку, описанию или ошибке"
            />
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Все"],
                ["pending", "В ожидании"],
                ["generating", "Генерация"],
                ["ready", "Готово"],
                ["failed", "Ошибка"],
                ["published", "Опубликовано"]
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={filter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(value as typeof filter)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {progressMessage ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{progressMessage}</div> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="text-sm text-muted-foreground">
            Автопайплайн подготавливает до 10 постов и сразу пытается опубликовать первый готовый. Для ручной публикации выбирайте только элементы со статусом <span className="font-medium">Готово</span>. Готово выбрано: {selectedReadyIds.length}. Показано: {visibleItems.length}.
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
        <table className="min-w-[1180px] w-full table-auto text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">
                <label className="flex cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={allSelected}
                    onChange={() =>
                      setSelectedIds((current) =>
                        allSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))
                      )
                    }
                  />
                </label>
              </th>
              <th className="w-36 p-3">Статус</th>
              <th className="w-56 p-3">Тема</th>
              <th className="w-56 p-3">Заголовок</th>
              <th className="w-28 p-3">Изображение</th>
              <th className="w-40 p-3">Запланировано</th>
              <th className="w-40 p-3">Опубликовано</th>
              <th className="w-52 p-3">Ошибка</th>
              <th className="w-40 p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
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
                  <td className="p-3 whitespace-nowrap">
                    <Badge className="whitespace-nowrap" variant={item.status === "failed" ? "destructive" : item.status === "published" ? "default" : item.status === "ready" && item.scheduledAt && new Date(item.scheduledAt).getTime() <= Date.now() ? "secondary" : "outline"}>
                      {translateQueueStatus(item.status, item.scheduledAt)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="max-w-[220px] break-words">{item.topicText ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    <div className="max-w-[220px] break-words">{item.title || "—"}</div>
                  </td>
                  <td className="p-3">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-20 w-20 rounded-md object-cover" /> : "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-xs">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3 whitespace-nowrap text-xs">{item.publishedAt ? new Date(item.publishedAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-3 text-red-600">
                    <div className="max-w-[200px] break-words">{item.error ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      {item.status === "ready" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void perform("publish-selected", () => postJson(`/api/flows/${flowId}/queue/publish`, { queueItemIds: [item.id] }))}
                          disabled={loading !== null}
                        >
                          Опубликовать
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
                        Показать логи
                      </Button>
                    </div>
                  </td>
                </tr>

                {expandedItemId === item.id ? (
                  <tr className="border-t bg-muted/20">
                    <td colSpan={9} className="p-4">
                      <div className="space-y-4">
                        {(runsByItem.get(item.id) ?? []).length > 0 ? (
                          (runsByItem.get(item.id) ?? []).map((run) => (
                            <Card key={run.id}>
                              <CardHeader>
                                <CardTitle className="text-base">
                                  Запуск {run.id} · {new Date(run.startedAt).toLocaleString("ru-RU")}
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
                          <p className="text-sm text-muted-foreground">Логов по этому элементу пока нет.</p>
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

      {visibleItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">По текущему фильтру и поиску элементов не найдено.</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Диагностика и логи для копирования</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={copyDebugLogs}>
            {copyState === "done" ? "Скопировано" : copyState === "error" ? "Ошибка копирования" : "Скопировать логи"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Если генерация, публикация или повтор завершаются ошибкой, скопируйте этот блок и отправьте его целиком.
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
