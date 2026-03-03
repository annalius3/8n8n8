"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LeonardoKeyItem = {
  id: string;
  name: string;
  updatedAt: string;
  isPrimary: boolean;
};

function maskName(name: string) {
  if (!name.trim()) return "Leonardo key";
  return name;
}

export function LeonardoSettingsForm({ keys: initialKeys }: { keys: LeonardoKeyItem[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState<null | "create" | `promote:${string}` | `delete:${string}`>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasKeys = keys.length > 0;
  const primaryKey = useMemo(() => keys.find((item) => item.isPrimary) ?? null, [keys]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading("create");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/leonardo-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, apiKey })
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        keys?: LeonardoKeyItem[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить ключ Leonardo");
      }

      setKeys(data.keys ?? []);
      setName("");
      setApiKey("");
      setMessage("Новый ключ Leonardo сохранён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить ключ Leonardo");
    } finally {
      setLoading(null);
    }
  }

  async function makePrimary(id: string) {
    setLoading(`promote:${id}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/leonardo-key", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; keys?: LeonardoKeyItem[] };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сделать ключ основным");
      }
      setKeys(data.keys ?? []);
      setMessage("Основной ключ Leonardo обновлён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сделать ключ основным");
    } finally {
      setLoading(null);
    }
  }

  async function removeKey(id: string) {
    setLoading(`delete:${id}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/leonardo-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; keys?: LeonardoKeyItem[] };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось удалить ключ Leonardo");
      }
      setKeys(data.keys ?? []);
      setMessage("Ключ Leonardo удалён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить ключ Leonardo");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ключи Leonardo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            {hasKeys
              ? `Сохранено ключей: ${keys.length}. Активный ключ: ${maskName(primaryKey?.name ?? "Leonardo key")}.`
              : "Сейчас приложение использует ключ из process.env.LEONARDO_API_KEY, если он задан на сервере."}
          </div>

          {keys.length > 0 ? (
            <div className="space-y-3">
              {keys.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {maskName(item.name)} {item.isPrimary ? <span className="text-emerald-700">(основной)</span> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!item.isPrimary ? (
                      <Button type="button" variant="outline" onClick={() => void makePrimary(item.id)} disabled={loading !== null}>
                        Сделать основным
                      </Button>
                    ) : null}
                    <Button type="button" variant="destructive" onClick={() => void removeKey(item.id)} disabled={loading !== null}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="leonardo-key-name">Название ключа</Label>
              <Input
                id="leonardo-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например: Leonardo Backup 1"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leonardo-api-key">Leonardo API Key</Label>
              <Input
                id="leonardo-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Введите новый Leonardo API key"
                autoComplete="off"
              />
            </div>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={loading !== null || apiKey.trim().length < 10}>
              {loading === "create" ? "Сохранение..." : "Добавить ключ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
