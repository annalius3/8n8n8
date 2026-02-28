"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type BoardItem = {
  id: string;
  name: string;
  privacy?: string;
};

export function CampaignSettingsForm({
  flowId,
  initialName,
  initialLanguage,
  initialPostsPerDay,
  initialTimezone,
  initialStartTime,
  initialAutopublishEnabled,
  initialNiche,
  initialAudience,
  initialTone,
  initialPinterestConnectionName,
  initialPinterestBoardId,
  availablePinterestConnections
}: {
  flowId: string;
  initialName: string;
  initialLanguage: string;
  initialPostsPerDay: number;
  initialTimezone: string;
  initialStartTime: string;
  initialAutopublishEnabled: boolean;
  initialNiche?: string | null;
  initialAudience?: string | null;
  initialTone?: string | null;
  initialPinterestConnectionName?: string;
  initialPinterestBoardId?: string;
  availablePinterestConnections: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [postsPerDay, setPostsPerDay] = useState(initialPostsPerDay);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [autopublishEnabled, setAutopublishEnabled] = useState(initialAutopublishEnabled);
  const [niche, setNiche] = useState(initialNiche ?? "");
  const [audience, setAudience] = useState(initialAudience ?? "");
  const [tone, setTone] = useState(initialTone ?? "");
  const [pinterestConnectionName, setPinterestConnectionName] = useState(initialPinterestConnectionName ?? "");
  const [pinterestBoardId, setPinterestBoardId] = useState(initialPinterestBoardId ?? "");
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBoards() {
    if (!pinterestConnectionName.trim()) {
      setError("Сначала выберите Pinterest-подключение");
      return;
    }

    setBoardsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/connections/pinterest/boards?connectionName=${encodeURIComponent(pinterestConnectionName)}`);
      const data = (await response.json().catch(() => ({}))) as { boards?: BoardItem[]; error?: string };
      if (!response.ok || !data.boards) {
        throw new Error(data.error ?? "Не удалось загрузить список досок");
      }

      setBoards(data.boards);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить список досок");
      setBoards([]);
    } finally {
      setBoardsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language,
          postsPerDay,
          timezone,
          startTime,
          autopublishEnabled,
          niche,
          audience,
          tone,
          pinterestConnectionName,
          pinterestBoardId
        })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось обновить настройки кампании");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить настройки кампании");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Параметры кампании</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Язык</Label>
              <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="EN">EN</option>
                <option value="RU">RU</option>
                <option value="UA">UA</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Постов в день</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={postsPerDay}
                onChange={(event) => setPostsPerDay(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Niche</Label>
              <Input value={niche} onChange={(event) => setNiche(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Input value={audience} onChange={(event) => setAudience(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Input value={tone} onChange={(event) => setTone(event.target.value)} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border p-4">
            <div className="space-y-2">
              <Label>Pinterest-подключение</Label>
              <Select value={pinterestConnectionName} onChange={(event) => setPinterestConnectionName(event.target.value)}>
                <option value="">Выберите подключение</option>
                {availablePinterestConnections.map((connectionName) => (
                  <option key={connectionName} value={connectionName}>
                    {connectionName}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Если списка нет, сначала сохраните токен на странице Подключения.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={loadBoards} disabled={boardsLoading || !pinterestConnectionName.trim()}>
                {boardsLoading ? "Загружаю доски..." : "Загрузить доски"}
              </Button>
            </div>

            {boards.length > 0 ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Доступные доски</p>
                {boards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    className="block w-full rounded-lg border bg-background px-3 py-2 text-left text-sm"
                    onClick={() => setPinterestBoardId(board.id)}
                  >
                    <div className="font-medium">{board.name}</div>
                    <div className="text-muted-foreground">
                      board_id: {board.id}
                      {board.privacy ? ` · ${board.privacy}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Board ID</Label>
              <Input value={pinterestBoardId} onChange={(event) => setPinterestBoardId(event.target.value)} placeholder="Например: 1234567890" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autopublishEnabled} onChange={(event) => setAutopublishEnabled(event.target.checked)} />
            Автопубликация включена
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Сохраняю..." : "Сохранить настройки"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
