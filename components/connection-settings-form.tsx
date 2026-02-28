"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SafeConnection = {
  id: string;
  provider: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type BoardItem = {
  id: string;
  name: string;
  privacy?: string;
};

type Props = {
  initialConnections: SafeConnection[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ConnectionSettingsForm({ initialConnections }: Props) {
  const [connections, setConnections] = useState(initialConnections);
  const [name, setName] = useState("My Pinterest");
  const [accessToken, setAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardItem[]>([]);

  const existingConnection = useMemo(
    () => connections.find((connection) => connection.provider === "pinterest" && connection.name === name),
    [connections, name]
  );

  async function saveConnection() {
    setError(null);
    setSaveMessage(null);
    setBoards([]);
    setIsSaving(true);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "pinterest",
          name,
          accessToken
        })
      });

      const data = (await response.json()) as {
        error?: string | { fieldErrors?: Record<string, string[]> };
        connection?: SafeConnection;
      };

      if (!response.ok || !data.connection) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.fieldErrors
              ? Object.entries(data.error.fieldErrors)
                  .flatMap(([, values]) => values ?? [])
                  .join(", ")
              : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435";
        throw new Error(message);
      }

      const savedConnection = data.connection;
      setConnections((current) => {
        const next = current.filter(
          (item) => item.id !== savedConnection.id && !(item.provider === savedConnection.provider && item.name === savedConnection.name)
        );
        return [savedConnection, ...next];
      });
      setAccessToken("");
      setSaveMessage("\u0422\u043e\u043a\u0435\u043d \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d \u0432 \u0437\u0430\u0448\u0438\u0444\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u043c \u0432\u0438\u0434\u0435 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0442\u043e\u043a\u0435\u043d"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function checkPinterest() {
    setError(null);
    setSaveMessage(null);
    setBoards([]);
    setIsChecking(true);

    try {
      const response = await fetch(`/api/connections/pinterest/boards?connectionName=${encodeURIComponent(name)}`);
      const data = (await response.json()) as { boards?: BoardItem[]; error?: string };
      if (!response.ok || !data.boards) {
        throw new Error(data.error ?? "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c Pinterest");
      }

      setBoards(data.boards);
      setSaveMessage(`Pinterest \u043e\u0442\u0432\u0435\u0442\u0438\u043b \u0443\u0441\u043f\u0435\u0448\u043d\u043e. \u041d\u0430\u0439\u0434\u0435\u043d\u043e \u0434\u043e\u0441\u043e\u043a: ${data.boards.length}.`);
    } catch (checkError) {
      setError(
        checkError instanceof Error ? checkError.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c Pinterest"
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Pinterest connection</CardTitle>
          <CardDescription>
            {
              "\u0422\u043e\u043a\u0435\u043d \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0432 \u0437\u0430\u0448\u0438\u0444\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u043c \u0432\u0438\u0434\u0435. \u041f\u043e\u0441\u043b\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f \u043a\u043b\u0438\u0435\u043d\u0442 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0435\u0433\u043e \u043e\u0431\u0440\u0430\u0442\u043d\u043e."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connection-name">{"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f"}</Label>
            <Input id="connection-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My Pinterest" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-token">Access token</Label>
            <Input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="pina_..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {
                "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043d\u043e\u0432\u044b\u0439 \u0442\u043e\u043a\u0435\u043d, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043d\u0435 \u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043b\u0441\u044f \u0432 \u0447\u0430\u0442\u0435, git \u0438\u043b\u0438 \u043b\u043e\u0433\u0430\u0445."
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveConnection} disabled={isSaving || name.trim().length < 2 || accessToken.trim().length < 20}>
              {isSaving ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e..." : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0442\u043e\u043a\u0435\u043d"}
            </Button>
            <Button variant="outline" onClick={checkPinterest} disabled={isChecking || name.trim().length < 2}>
              {isChecking ? "\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e..." : "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c Pinterest"}
            </Button>
            {existingConnection ? <Badge variant="outline">{"\u0415\u0441\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u043e\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435"}</Badge> : null}
          </div>
          {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {boards.length > 0 ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="text-sm font-medium">{"\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u0434\u043e\u0441\u043a\u0438"}</div>
              <div className="space-y-2">
                {boards.map((board) => (
                  <div key={board.id} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <div className="font-medium">{board.name}</div>
                    <div className="text-muted-foreground">
                      board_id: {board.id}
                      {board.privacy ? ` · ${board.privacy}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{"\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f"}</CardTitle>
          <CardDescription>{"\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u043c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435 \u0431\u0435\u0437 \u0442\u043e\u043a\u0435\u043d\u043e\u0432."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {
                "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0439. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 Pinterest token, \u043f\u043e\u0442\u043e\u043c \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u043f\u0438\u0441\u043e\u043a \u0434\u043e\u0441\u043e\u043a."
              }
            </div>
          ) : (
            connections.map((connection) => (
              <div key={connection.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-sm text-muted-foreground">{connection.provider}</div>
                  </div>
                  <Badge variant="outline">{"\u0422\u043e\u043a\u0435\u043d \u0441\u043a\u0440\u044b\u0442"}</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {"\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e"}: {formatDate(connection.updatedAt)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
