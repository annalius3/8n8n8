"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteFlowButton({
  flowId,
  redirectToFlows = false
}: {
  flowId: string;
  redirectToFlows?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFlow() {
    const confirmed = window.confirm("Удалить этот поток и все связанные темы, элементы очереди и логи? Это действие нельзя отменить.");
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Не удалось удалить поток");
        return;
      }

      if (redirectToFlows) {
        router.push("/flows");
      }
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="destructive" onClick={removeFlow} disabled={loading}>
        {loading ? "Удаление..." : "Удалить поток"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
