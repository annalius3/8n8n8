"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FlowToggleButton({ flowId, initialEnabled }: { flowId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !enabled })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Failed to update flow status");
        return;
      }

      setEnabled(!enabled);
      router.refresh();
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={toggle} disabled={loading}>
        {loading ? "Saving..." : enabled ? "Disable" : "Enable"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

