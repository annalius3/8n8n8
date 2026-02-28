"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LeonardoSettingsForm({ hasKey, updatedAt }: { hasKey: boolean; updatedAt: string | null }) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/leonardo-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить ключ Leonardo");
      }

      setApiKey("");
      setMessage("Ключ Leonardo сохранён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить ключ Leonardo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Смена ключа Leonardo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          {hasKey
            ? `Персональный Leonardo key уже сохранён.${updatedAt ? ` Обновлён: ${new Date(updatedAt).toLocaleString("ru-RU")}.` : ""}`
            : "Пока используется ключ из process.env.LEONARDO_API_KEY."}
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Leonardo API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Введите новый Leonardo API key"
              autoComplete="off"
            />
          </div>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading || apiKey.trim().length < 10}>
            {loading ? "Сохраняю..." : "Сохранить / обновить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
