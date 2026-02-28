"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FlowToggleButton({ flowId, initialEnabled }: { flowId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    const response = await fetch(`/api/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !enabled })
    });

    if (response.ok) {
      setEnabled(!enabled);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={loading}>
      {loading ? "Сохранение..." : enabled ? "Выключить" : "Включить"}
    </Button>
  );
}
