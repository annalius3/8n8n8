"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState(initialConnections);
  const [name, setName] = useState("Main Pinterest");
  const [accessToken, setAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardItem[]>([]);

  const existingConnection = useMemo(
    () => connections.find((connection) => connection.provider === "pinterest" && connection.name === name),
    [connections, name]
  );

  const oauthError = searchParams.get("error");
  const oauthSuccess = searchParams.get("success");

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
              : "Не удалось сохранить подключение";
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
      setSaveMessage("Токен сохранён на сервере в зашифрованном виде.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить токен");
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
        throw new Error(data.error ?? "Не удалось проверить Pinterest");
      }

      setBoards(data.boards);
      setSaveMessage(`Pinterest ответил успешно. Найдено досок: ${data.boards.length}.`);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Не удалось проверить Pinterest");
    } finally {
      setIsChecking(false);
    }
  }

  async function disconnectPinterest() {
    if (!existingConnection) {
      return;
    }

    setError(null);
    setSaveMessage(null);
    setBoards([]);
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "pinterest",
          name
        })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось отключить Pinterest");
      }

      setConnections((current) => current.filter((item) => !(item.provider === "pinterest" && item.name === name)));
      setAccessToken("");
      setBoards([]);
      setSaveMessage("Pinterest отключён. Теперь можно подключить его заново с чистого состояния.");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Не удалось отключить Pinterest");
    } finally {
      setIsDisconnecting(false);
    }
  }

  function startPinterestOAuth() {
    setError(null);
    setSaveMessage(null);
    const connectionName = name.trim() || "Main Pinterest";
    window.location.href = `/api/connections/pinterest/oauth/start?name=${encodeURIComponent(connectionName)}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Подключение Pinterest</CardTitle>
          <CardDescription>
            Используйте OAuth, если это возможно. Ручное сохранение токена оставлено как запасной вариант.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthSuccess === "pinterest_oauth" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              OAuth-подключение Pinterest завершено успешно. Подключение сохранено на сервере.
            </div>
          ) : null}
          {oauthError === "pinterest_oauth_not_configured" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Pinterest OAuth пока не настроен. Добавьте `PINTEREST_CLIENT_ID` и `PINTEREST_CLIENT_SECRET` на сервере.
            </div>
          ) : null}
          {oauthError === "pinterest_oauth" ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Ошибка Pinterest OAuth. Проверьте настройки приложения, redirect URI и scopes.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="connection-name">Название подключения</Label>
            <Input id="connection-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Pinterest" />
          </div>

          {existingConnection ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Статус: подключено. Для этого имени уже сохранён Pinterest-токен на сервере.
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Статус: не подключено. Запустите OAuth-подключение ниже.
            </div>
          )}

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3">
              <div className="font-medium">Предпочтительный способ: Pinterest OAuth</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Нажмите красную кнопку, перейдите на Pinterest, подтвердите запрашиваемые права и вернитесь сюда со статусом подключения.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" onClick={startPinterestOAuth}>Подключить Pinterest</Button>
              <Button variant="outline" onClick={disconnectPinterest} disabled={!existingConnection || isDisconnecting}>
                {isDisconnecting ? "Отключение..." : "Отключить Pinterest"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3">
              <div className="font-medium">Резервный вариант: ручной токен</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Используйте этот вариант, только если у вас уже есть Pinterest access token и вы не хотите проходить OAuth прямо сейчас.
              </p>
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
              <p className="text-xs text-muted-foreground">Используйте токен, который ни разу не публиковался в чате, git или логах.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={saveConnection} disabled={isSaving || name.trim().length < 2 || accessToken.trim().length < 20}>
                {isSaving ? "Сохранение..." : "Сохранить токен"}
              </Button>
              <Button variant="outline" onClick={checkPinterest} disabled={isChecking || name.trim().length < 2}>
                {isChecking ? "Проверка..." : "Проверить Pinterest"}
              </Button>
              {existingConnection ? <Badge variant="outline">Подключение уже сохранено</Badge> : null}
            </div>
          </div>

          {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {boards.length > 0 ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="text-sm font-medium">Доступные доски</div>
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
          <CardTitle>Сохранённые подключения</CardTitle>
          <CardDescription>Здесь видны только безопасные метаданные. Токены и секреты никогда не показываются.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Подключений пока нет. Создайте Pinterest OAuth-подключение или сохраните ручной токен.
            </div>
          ) : (
            connections.map((connection) => (
              <div key={connection.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-sm text-muted-foreground">{connection.provider}</div>
                  </div>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Подключено</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">Обновлено: {formatDate(connection.updatedAt)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
