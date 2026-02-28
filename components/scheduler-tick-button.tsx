"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SchedulerTickButton() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const response = await fetch("/api/scheduler/tick", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { started?: number; due?: number; error?: string };

      if (!response.ok || typeof data.started !== "number") {
        setStatus(data.error ?? "Не удалось выполнить тик планировщика");
        return;
      }

      setStatus(`Запущено потоков: ${data.started}${data.due !== undefined ? ` из ${data.due}` : ""}`);
    } catch {
      setStatus("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading ? "Проверка..." : "Проверить расписание"}
      </Button>
      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
    </div>
  );
}
