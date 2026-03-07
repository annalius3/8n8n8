"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RedditStatus = {
  configured: boolean;
  updatedAt: string | null;
  name: string;
};

export function RedditSettingsForm({ initialStatus }: { initialStatus: RedditStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [loading, setLoading] = useState<null | "save" | "delete">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading("save");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings/reddit-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret,
          username,
          password,
          userAgent
        })
      });

      const data = (await response.json().catch(() => ({}))) as {
        configured?: boolean;
        updatedAt?: string | null;
        name?: string;
        error?: string | { fieldErrors?: Record<string, string[]> };
      };

      if (!response.ok) {
        const text =
          typeof data.error === "string"
            ? data.error
            : data.error?.fieldErrors
              ? Object.values(data.error.fieldErrors)
                  .flat()
                  .filter(Boolean)
                  .join(", ")
              : "Не удалось сохранить Reddit API credentials";
        throw new Error(text);
      }

      setStatus({
        configured: Boolean(data.configured),
        updatedAt: data.updatedAt ?? null,
        name: data.name ?? "Reddit API"
      });
      setClientId("");
      setClientSecret("");
      setUsername("");
      setPassword("");
      setUserAgent("");
      setMessage("Reddit credentials сохранены на сервере в зашифрованном виде.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить Reddit credentials");
    } finally {
      setLoading(null);
    }
  }

  async function removeCredentials() {
    setLoading("delete");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings/reddit-credentials", {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as RedditStatus & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось удалить Reddit credentials");
      }

      setStatus({
        configured: Boolean(data.configured),
        updatedAt: data.updatedAt ?? null,
        name: data.name ?? "Reddit API"
      });
      setMessage("Reddit credentials удалены.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить Reddit credentials");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reddit API</CardTitle>
        <CardDescription>
          Сюда добавляются ключи для Reddit. Они нужны для будущей автопубликации в Reddit и хранятся только на сервере.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>Где взять:</p>
          <p>`client id` и `client secret` — в Reddit App Preferences.</p>
          <p>`username` и `password` — от Reddit-аккаунта, через который будет идти публикация.</p>
          <p>`user agent` — строка вида `web:scheduled-publishing:v1.0 (by /u/your_username)`.</p>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p>Статус: {status.configured ? "настроено" : "не настроено"}</p>
          <p className="text-muted-foreground">Обновлено: {status.updatedAt ? new Date(status.updatedAt).toLocaleString("ru-RU") : "-"}</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reddit-client-id">Client ID</Label>
              <Input
                id="reddit-client-id"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="Reddit app client id"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reddit-client-secret">Client Secret</Label>
              <Input
                id="reddit-client-secret"
                type="password"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder="Reddit app client secret"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reddit-username">Username</Label>
              <Input
                id="reddit-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="reddit_username"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reddit-password">Password</Label>
              <Input
                id="reddit-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="reddit_password"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reddit-user-agent">User Agent</Label>
            <Input
              id="reddit-user-agent"
              value={userAgent}
              onChange={(event) => setUserAgent(event.target.value)}
              placeholder="web:scheduled-publishing:v1.0 (by /u/your_username)"
              autoComplete="off"
            />
          </div>

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                loading !== null ||
                clientId.trim().length < 3 ||
                clientSecret.trim().length < 6 ||
                username.trim().length < 2 ||
                password.trim().length < 3 ||
                userAgent.trim().length < 6
              }
            >
              {loading === "save" ? "Сохранение..." : "Сохранить Reddit API"}
            </Button>

            <Button type="button" variant="destructive" disabled={loading !== null || !status.configured} onClick={() => void removeCredentials()}>
              {loading === "delete" ? "Удаление..." : "Удалить Reddit API"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
