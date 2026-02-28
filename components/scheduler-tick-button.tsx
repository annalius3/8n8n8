"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SchedulerTickButton() {
  const [status, setStatus] = useState<string>("");

  async function onClick() {
    const response = await fetch("/api/scheduler/tick", { method: "POST" });
    if (!response.ok) {
      setStatus("Не удалось выполнить тик планировщика");
      return;
    }

    const data = (await response.json()) as { started: number; checkedAt: string; due?: number };
    setStatus(`Запущено потоков: ${data.started}${data.due !== undefined ? ` из ${data.due}` : ""}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onClick}>
        Запустить планировщик
      </Button>
      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
    </div>
  );
}
