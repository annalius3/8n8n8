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
  return new Intl.DateTimeFormat("en-US", {
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
              : "Failed to save the connection";
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
      setSaveMessage("The token was saved in encrypted form on the server.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the token");
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
        throw new Error(data.error ?? "Failed to check Pinterest");
      }

      setBoards(data.boards);
      setSaveMessage(`Pinterest responded successfully. Boards found: ${data.boards.length}.`);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Failed to check Pinterest");
    } finally {
      setIsChecking(false);
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
          <CardTitle>Pinterest connection</CardTitle>
          <CardDescription>
            Use OAuth if possible. Manual token save stays available as a fallback for existing access tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthSuccess === "pinterest_oauth" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Pinterest OAuth completed successfully. The connection was saved on the server.
            </div>
          ) : null}
          {oauthError === "pinterest_oauth_not_configured" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Pinterest OAuth is not configured yet. Add `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET` on the server.
            </div>
          ) : null}
          {oauthError === "pinterest_oauth" ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Pinterest OAuth failed. Check the app settings, redirect URI, and requested scopes.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="connection-name">Connection name</Label>
            <Input id="connection-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Pinterest" />
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-3">
              <div className="font-medium">Preferred: Pinterest OAuth</div>
              <p className="mt-1 text-sm text-muted-foreground">
                This stores the Pinterest access token server-side after the OAuth callback. No token is typed into the browser.
              </p>
            </div>
            <Button onClick={startPinterestOAuth}>Connect with Pinterest OAuth</Button>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3">
              <div className="font-medium">Fallback: manual token</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this only if you already have a Pinterest access token and do not want to go through OAuth right now.
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
              <p className="text-xs text-muted-foreground">Use a token that has never been posted in chat, git, or logs.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={saveConnection} disabled={isSaving || name.trim().length < 2 || accessToken.trim().length < 20}>
                {isSaving ? "Saving..." : "Save token"}
              </Button>
              <Button variant="outline" onClick={checkPinterest} disabled={isChecking || name.trim().length < 2}>
                {isChecking ? "Checking..." : "Check Pinterest"}
              </Button>
              {existingConnection ? <Badge variant="outline">Saved connection exists</Badge> : null}
            </div>
          </div>

          {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {boards.length > 0 ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="text-sm font-medium">Available boards</div>
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
          <CardTitle>Saved connections</CardTitle>
          <CardDescription>Only safe metadata is shown here. Tokens and secrets are never exposed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No saved connections yet. Create a Pinterest OAuth connection or save a manual token first.
            </div>
          ) : (
            connections.map((connection) => (
              <div key={connection.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-sm text-muted-foreground">{connection.provider}</div>
                  </div>
                  <Badge variant="outline">Secret hidden</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">Updated: {formatDate(connection.updatedAt)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
