"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  initialTone
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          tone
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
        <CardTitle>Настройки кампании</CardTitle>
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
