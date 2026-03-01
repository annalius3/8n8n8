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
    const confirmed = window.confirm("Delete this flow and all related topics, queue items, and logs? This action cannot be undone.");
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Failed to delete flow");
        return;
      }

      if (redirectToFlows) {
        router.push("/flows");
      }
      router.refresh();
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="destructive" onClick={removeFlow} disabled={loading}>
        {loading ? "Deleting..." : "Delete flow"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
