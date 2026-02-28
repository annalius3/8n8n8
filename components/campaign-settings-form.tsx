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

type IntervalUnit = "minutes" | "hours" | "days";

function parseIntervalCron(cron?: string) {
  if (!cron) return null;

  const minuteMatch = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minuteMatch) {
    return { enabled: true, value: Number(minuteMatch[1]), unit: "minutes" as IntervalUnit };
  }

  const hourMatch = cron.match(/^(\d+)\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourMatch) {
    return { enabled: true, value: Number(hourMatch[2]), unit: "hours" as IntervalUnit };
  }

  const dayMatch = cron.match(/^(\d+)\s+(\d+)\s+\*\/(\d+)\s+\*\s+\*$/);
  if (dayMatch) {
    return { enabled: true, value: Number(dayMatch[3]), unit: "days" as IntervalUnit };
  }

  return { enabled: false, value: 6, unit: "hours" as IntervalUnit };
}

function buildIntervalCron(input: { enabled: boolean; value: number; unit: IntervalUnit; startTime: string }) {
  if (!input.enabled) {
    return "0 0 * * *";
  }

  const safeValue = Math.max(1, Math.min(input.unit === "minutes" ? 59 : 30, Math.floor(input.value || 1)));
  const [hourRaw, minuteRaw] = input.startTime.split(":");
  const hour = Math.max(0, Math.min(23, Number(hourRaw ?? 0) || 0));
  const minute = Math.max(0, Math.min(59, Number(minuteRaw ?? 0) || 0));

  if (input.unit === "minutes") {
    return `*/${safeValue} * * * *`;
  }

  if (input.unit === "hours") {
    return `${minute} */${safeValue} * * *`;
  }

  return `${minute} ${hour} */${safeValue} * *`;
}

export function CampaignSettingsForm({
  flowId,
  initialName,
  initialLanguage,
  initialPostsPerDay,
  initialTimezone,
  initialStartTime,
  initialAutopublishEnabled,
  initialCron,
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
  initialCron?: string | null;
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
  const initialInterval = parseIntervalCron(initialCron ?? undefined) ?? {
    enabled: false,
    value: 6,
    unit: "hours" as IntervalUnit
  };
  const [useIntervalScheduling, setUseIntervalScheduling] = useState(initialInterval.enabled);
  const [scheduleEveryValue, setScheduleEveryValue] = useState(initialInterval.value);
  const [scheduleEveryUnit, setScheduleEveryUnit] = useState<IntervalUnit>(initialInterval.unit);
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
      if (data.boards.length === 1) {
        setPinterestBoardId(data.boards[0].id);
      }
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
          cron: buildIntervalCron({
            enabled: useIntervalScheduling,
            value: scheduleEveryValue,
            unit: scheduleEveryUnit,
            startTime
          }),
          niche,
          audience,
          tone,
          pinterestConnectionName,
          pinterestBoardId
        })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось обновить настройки потока");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить настройки потока");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Параметры потока</CardTitle>
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
              <Label>Часовой пояс</Label>
              <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Время старта</Label>
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </div>
          </div>
          <div className="space-y-4 rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useIntervalScheduling} onChange={(event) => setUseIntervalScheduling(event.target.checked)} />
              <span>Публиковать по интервалу</span>
            </div>
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="space-y-2">
                <Label>Каждые</Label>
                <Input
                  type="number"
                  min={1}
                  max={scheduleEveryUnit === "minutes" ? 59 : 30}
                  value={scheduleEveryValue}
                  onChange={(event) => setScheduleEveryValue(Math.max(1, Number(event.target.value) || 1))}
                  disabled={!useIntervalScheduling}
                />
              </div>
              <div className="space-y-2">
                <Label>Единица</Label>
                <Select value={scheduleEveryUnit} onChange={(event) => setScheduleEveryUnit(event.target.value as IntervalUnit)} disabled={!useIntervalScheduling}>
                  <option value="minutes">минут</option>
                  <option value="hours">часов</option>
                  <option value="days">дней</option>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Если интервал включён, очередь будет планироваться по схеме «каждые N минут/часов/дней». Если выключен, остаётся режим
              распределения по количеству постов в день.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Ниша</Label>
              <Input value={niche} onChange={(event) => setNiche(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Аудитория</Label>
              <Input value={audience} onChange={(event) => setAudience(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Тон</Label>
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
