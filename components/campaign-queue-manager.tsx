"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExecutionTimeline } from "@/components/execution-timeline";

function translateQueueStatus(status: string) {
  if (status === "pending") return "Pending";
  if (status === "generating") return "Generating";
  if (status === "ready") return "Ready";
  if (status === "publishing") return "Publishing";
  if (status === "published") return "Published";
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing";
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
    throw new Error(data.error ?? "Failed to complete the request");
  }
  return data;
}

function getSuccessMessage(action: string, data: ActionResponse) {
  if (action === "plan") return `Schedule updated for ${data.count ?? 0} items.`;
  if (action === "generate-all") {
    if ((data.generated ?? 0) === 0 && (data.published ?? 0) === 0) {
      return "No suitable items are available for auto-generation right now. The queue is either empty or already processed.";
    }
    return `Processed ${data.generated ?? 0} item(s): generated up to 3 and published ${data.published ?? 0}.`;
  }
  if (action === "generate-selected") {
    return `Text and images updated for ${data.processed ?? 0} item(s).`;
  }
  if (action === "publish-selected" || action === "publish-due") {
    return `Published ${data.processed ?? 0} item(s).`;
  }
  if (action === "retry") {
    if ((data.updated ?? 0) === 0) {
      return "No failed items were found for retry.";
    }
    return `Prepared ${data.updated ?? 0} item(s) for retry.`;
  }
  if (action === "delete") return `Deleted ${data.deleted ?? 0} item(s).`;
  return "Action completed.";
}

export function CampaignQueueManager({
  flowId,
  autoStartGenerate = false,
  initialItems,
  initialRuns
}: {
  flowId: string;
  autoStartGenerate?: boolean;
  initialItems: QueueItem[];
  initialRuns: Run[];
}) {
  const router = useRouter();
  const autoStartRef = useRef(false);
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
  const pendingIds = initialItems.filter((item) => item.status === "pending" || item.status === "failed").map((item) => item.id);
  const generatedCount = initialItems.filter((item) => item.status === "ready" || item.status === "published" || item.status === "publishing").length;
  const selectedReadyIds = selectedIds.filter((id) => readyIds.includes(id));
  const selectedFailedIds = selectedIds.filter((id) => failedIds.includes(id));
  const criticalErrors = useMemo(() => {
    const messages = new Set<string>();

    if (error) messages.add(error);
    for (const item of initialItems) {
      if (item.error) messages.add(item.error);
    }
    for (const run of initialRuns) {
      if (run.status === "failed" && run.error) messages.add(run.error);
      for (const step of run.steps) {
        if (step.status === "failed" && step.error) messages.add(step.error);
      }
    }

    return Array.from(messages).map((message) => {
      if (message.includes("Missing: ['boards:write', 'pins:write']")) {
        return "The Pinterest token does not have publishing permissions. Required scopes: boards:write and pins:write.";
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

    return lines.join("\n").trim() || "No logs yet.";
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
      setError(requestError instanceof Error ? requestError.message : "Failed to complete the request");
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (!autoStartGenerate || autoStartRef.current) return;
    if (pendingIds.length === 0 || generatedCount > 0) return;

    autoStartRef.current = true;
    void perform("generate-selected", () =>
      postJson(`/api/flows/${flowId}/queue/generate`, { queueItemIds: [pendingIds[0]] })
    );
  }, [autoStartGenerate, flowId, generatedCount, pendingIds]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Queue / Content pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => selectIds(readyIds)} disabled={loading !== null || readyIds.length === 0}>
              Select ready
            </Button>
            <Button type="button" variant="outline" onClick={() => selectIds(failedIds)} disabled={loading !== null || failedIds.length === 0}>
              Select failed
            </Button>
            <Button type="button" variant="outline" onClick={() => selectIds([])} disabled={loading !== null || selectedIds.length === 0}>
              Clear selection
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("plan", () => postJson(`/api/flows/${flowId}/queue/plan-schedule`, {}))}
              disabled={loading !== null}
            >
              Plan schedule
            </Button>
            <Button
              type="button"
              onClick={() => perform("generate-all", () => postJson(`/api/flows/${flowId}/queue/generate`, { autoPipeline: true }))}
              disabled={loading !== null || allIds.length === 0}
            >
              Prepare next 3 and publish 1
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("generate-selected", () => postJson(`/api/flows/${flowId}/queue/generate`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Generate text and image
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedReadyIds.length === 0) {
                  setError('Select items with status "Ready" before publishing.');
                  setSuccess(null);
                  return;
                }
                void perform("publish-selected", () => postJson(`/api/flows/${flowId}/queue/publish`, { queueItemIds: selectedReadyIds }));
              }}
              disabled={loading !== null || selectedReadyIds.length === 0}
            >
              Publish selected
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => perform("publish-due", () => postJson(`/api/flows/${flowId}/queue/publish`, { dueOnly: true }))}
              disabled={loading !== null}
            >
              Publish due now
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
              Retry failed
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => perform("delete", () => postJson(`/api/flows/${flowId}/queue/delete`, { queueItemIds: selectedIds }))}
              disabled={loading !== null || selectedIds.length === 0}
            >
              Delete selected
            </Button>
          </div>
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <p className="text-sm text-muted-foreground">
            Select only items with status <span className="font-medium">Ready</span> for publishing. Ready items selected: {selectedReadyIds.length}.
          </p>
        </CardContent>
      </Card>

      {criticalErrors.length > 0 ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardHeader>
            <CardTitle className="text-red-700">Critical errors</CardTitle>
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
              <th className="w-28 p-3">Status</th>
              <th className="w-48 p-3">Topic</th>
              <th className="w-48 p-3">Title</th>
              <th className="w-[340px] p-3">Description</th>
              <th className="w-28 p-3">Image</th>
              <th className="w-40 p-3">Scheduled</th>
              <th className="w-40 p-3">Published</th>
              <th className="w-52 p-3">Error</th>
              <th className="p-3">Logs</th>
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
                  <td className="p-3">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("en-US") : "—"}</td>
                  <td className="p-3">{item.publishedAt ? new Date(item.publishedAt).toLocaleString("en-US") : "—"}</td>
                  <td className="p-3 text-red-600">
                    <div className="max-w-[200px] break-words">{item.error ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
                      View logs
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
                                  Run {run.id} · {new Date(run.startedAt).toLocaleString("en-US")}
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
                          <p className="text-sm text-muted-foreground">No logs yet for this item.</p>
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
          <CardTitle>Diagnostics and copy-ready logs</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={copyDebugLogs}>
            {copyState === "done" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy logs"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If generation, publishing, or retry fails, copy this block and send it as-is.
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


