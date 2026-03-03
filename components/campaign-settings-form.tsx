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
type ScheduleMode = "posts_per_day" | "interval" | "random_daily";

function parseScheduleMode(cron?: string) {
  if (!cron) {
    return {
      mode: "posts_per_day" as ScheduleMode,
      value: 6,
      unit: "hours" as IntervalUnit
    };
  }

  if (cron === "random_daily") {
    return {
      mode: "random_daily" as ScheduleMode,
      value: 6,
      unit: "hours" as IntervalUnit
    };
  }

  const minuteMatch = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minuteMatch) {
    return { mode: "interval" as ScheduleMode, value: Number(minuteMatch[1]), unit: "minutes" as IntervalUnit };
  }

  const hourMatch = cron.match(/^(\d+)\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourMatch) {
    return { mode: "interval" as ScheduleMode, value: Number(hourMatch[2]), unit: "hours" as IntervalUnit };
  }

  const dayMatch = cron.match(/^(\d+)\s+(\d+)\s+\*\/(\d+)\s+\*\s+\*$/);
  if (dayMatch) {
    return { mode: "interval" as ScheduleMode, value: Number(dayMatch[3]), unit: "days" as IntervalUnit };
  }

  return {
    mode: "posts_per_day" as ScheduleMode,
    value: 6,
    unit: "hours" as IntervalUnit
  };
}

function buildScheduleCron(input: { mode: ScheduleMode; value: number; unit: IntervalUnit; startTime: string }) {
  if (input.mode === "posts_per_day") {
    return "0 0 * * *";
  }

  if (input.mode === "random_daily") {
    return "random_daily";
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

type Props = {
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
};

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
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [postsPerDay, setPostsPerDay] = useState(initialPostsPerDay);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [autopublishEnabled, setAutopublishEnabled] = useState(initialAutopublishEnabled);
  const initialSchedule = parseScheduleMode(initialCron ?? undefined);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialSchedule.mode);
  const [scheduleEveryValue, setScheduleEveryValue] = useState(initialSchedule.value);
  const [scheduleEveryUnit, setScheduleEveryUnit] = useState<IntervalUnit>(initialSchedule.unit);
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
      setError("Сначала выберите подключение Pinterest");
      return;
    }

    setBoardsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/connections/pinterest/boards?connectionName=${encodeURIComponent(pinterestConnectionName)}`);
      const data = (await response.json().catch(() => ({}))) as { boards?: BoardItem[]; error?: string };
      if (!response.ok || !data.boards) {
        throw new Error(data.error ?? "Не удалось загрузить доски");
      }

      setBoards(data.boards);
      if (data.boards.length === 1) {
        setPinterestBoardId(data.boards[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить доски");
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
          cron: buildScheduleCron({
            mode: scheduleMode,
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
        throw new Error(data.error ?? "Не удалось сохранить настройки потока");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить настройки потока");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки автопостинга</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Название потока</Label>
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
              <Label>Публикаций в день</Label>
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
            <div className="space-y-2">
              <Label>Режим расписания</Label>
              <Select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}>
                <option value="posts_per_day">Определённое количество публикаций в день</option>
                <option value="interval">Фиксированный промежуток времени</option>
                <option value="random_daily">Хаотично по времени</option>
              </Select>
            </div>

            {scheduleMode === "posts_per_day" ? (
              <p className="text-xs text-muted-foreground">
                Посты будут равномерно распределяться в течение каждого дня. Количество берётся из поля «Публикаций в день».
              </p>
            ) : null}

            {scheduleMode === "interval" ? (
              <>
                <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="space-y-2">
                    <Label>Каждые</Label>
                    <Input
                      type="number"
                      min={1}
                      max={scheduleEveryUnit === "minutes" ? 59 : 30}
                      value={scheduleEveryValue}
                      onChange={(event) => setScheduleEveryValue(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Единица</Label>
                    <Select value={scheduleEveryUnit} onChange={(event) => setScheduleEveryUnit(event.target.value as IntervalUnit)}>
                      <option value="minutes">минут</option>
                      <option value="hours">часов</option>
                      <option value="days">дней</option>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Используйте этот режим, если нужен строгий фиксированный интервал между публикациями.
                </p>
              </>
            ) : null}

            {scheduleMode === "random_daily" ? (
              <p className="text-xs text-muted-foreground">
                Посты будут публиковаться хаотично в течение дня после времени старта. Количество публикаций в день берётся из поля выше.
              </p>
            ) : null}
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
              <p className="text-xs text-muted-foreground">
                Если список пуст, сначала сохраните токен или подключите Pinterest на странице подключений.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={loadBoards} disabled={boardsLoading || !pinterestConnectionName.trim()}>
                {boardsLoading ? "Загрузка досок..." : "Загрузить доски"}
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
              <Label>ID доски</Label>
              <Input value={pinterestBoardId} onChange={(event) => setPinterestBoardId(event.target.value)} placeholder="Например: 1234567890" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autopublishEnabled} onChange={(event) => setAutopublishEnabled(event.target.checked)} />
            Включить автопостинг
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
