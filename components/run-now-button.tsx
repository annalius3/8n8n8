"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunNowButton({ flowId }: { flowId: string }) {
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function runNow() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/flows/${flowId}/run`, { method: "POST" });
    if (response.ok) {
      const data = (await response.json()) as { runId: string };
      setRunId(data.runId);
      router.refresh();
    } else {
      setError("Запуск не удался");
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={runNow} disabled={loading}>
        {loading ? "Запуск..." : "Запустить сейчас"}
      </Button>
      {runId ? <span className="text-xs text-muted-foreground">run_id: {runId}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
