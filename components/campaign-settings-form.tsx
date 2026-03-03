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
type ScheduleMode = "posts_per_day" | "interval";

function parseIntervalCron(cron?: string) {
  if (!cron) {
    return null;
  }

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
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialInterval.enabled ? "interval" : "posts_per_day");
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
      setError("Select a Pinterest connection first");
      return;
    }

    setBoardsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/connections/pinterest/boards?connectionName=${encodeURIComponent(pinterestConnectionName)}`);
      const data = (await response.json().catch(() => ({}))) as { boards?: BoardItem[]; error?: string };
      if (!response.ok || !data.boards) {
        throw new Error(data.error ?? "Failed to load boards");
      }

      setBoards(data.boards);
      if (data.boards.length === 1) {
        setPinterestBoardId(data.boards[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load boards");
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
            enabled: scheduleMode === "interval",
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
        throw new Error(data.error ?? "Failed to update flow settings");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update flow settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autoposting settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="EN">EN</option>
                <option value="RU">RU</option>
                <option value="UA">UA</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Posts per day</Label>
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
          <div className="space-y-4 rounded-xl border p-4">
            <div className="space-y-2">
              <Label>Schedule mode</Label>
              <Select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}>
                <option value="posts_per_day">Fixed number of posts per day</option>
                <option value="interval">Publish by interval</option>
              </Select>
            </div>
            {scheduleMode === "posts_per_day" ? (
              <p className="text-xs text-muted-foreground">
                The queue will be spread evenly during the day. The number of publications is taken from the "Posts per day" field.
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="space-y-2">
                    <Label>Every</Label>
                    <Input
                      type="number"
                      min={1}
                      max={scheduleEveryUnit === "minutes" ? 59 : 30}
                      value={scheduleEveryValue}
                      onChange={(event) => setScheduleEveryValue(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={scheduleEveryUnit} onChange={(event) => setScheduleEveryUnit(event.target.value as IntervalUnit)}>
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this mode only when you need a strict interval between publications. For most autoposting flows, the daily-posts mode is better.
                </p>
              </>
            )}
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
              <Label>Pinterest connection</Label>
              <Select value={pinterestConnectionName} onChange={(event) => setPinterestConnectionName(event.target.value)}>
                <option value="">Select a connection</option>
                {availablePinterestConnections.map((connectionName) => (
                  <option key={connectionName} value={connectionName}>
                    {connectionName}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">If the list is empty, save a token first on the Connections page.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={loadBoards} disabled={boardsLoading || !pinterestConnectionName.trim()}>
                {boardsLoading ? "Loading boards..." : "Load boards"}
              </Button>
            </div>

            {boards.length > 0 ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Available boards</p>
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
              <Input value={pinterestBoardId} onChange={(event) => setPinterestBoardId(event.target.value)} placeholder="For example: 1234567890" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autopublishEnabled} onChange={(event) => setAutopublishEnabled(event.target.checked)} />
            Autoposting enabled
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
