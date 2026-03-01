"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function getCurrentTimeForTimezone(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return formatter.format(new Date());
}

export function FlowWizardForm() {
  const router = useRouter();
  const [seedTopic, setSeedTopic] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"EN" | "RU" | "UA">("EN");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [timezone, setTimezone] = useState("Europe/Kiev");
  const [startTime, setStartTime] = useState(() => getCurrentTimeForTimezone("Europe/Kiev"));
  const [autopublishEnabled, setAutopublishEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          seedTopic,
          language,
          niche,
          audience,
          tone,
          postsPerDay,
          timezone,
          startTime,
          autopublishEnabled
        })
      });

      const data = (await response.json().catch(() => ({}))) as {
        flowId?: string;
        error?: string | { fieldErrors?: Record<string, string[]> };
      };

      if (!response.ok || !data.flowId) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.fieldErrors
              ? Object.values(data.error.fieldErrors).flat().filter(Boolean).join(", ")
              : "Failed to create flow";
        setError(message);
        return;
      }

      router.push(`/flows/${data.flowId}/topics`);
      router.refresh();
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 1. Seed topic</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Flow name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="For example: Calm Energy Campaign" />
            </div>
            <div className="space-y-2">
              <Label>Seed topic</Label>
              <Textarea
                rows={3}
                value={seedTopic}
                onChange={(event) => setSeedTopic(event.target.value)}
                placeholder="For example: morning routine for calm energy"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onChange={(event) => setLanguage(event.target.value as "EN" | "RU" | "UA")}>
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
                <Label>Niche / angle</Label>
                <Input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="healing, wellness, finance" />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="new moms, founders, students" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Input value={tone} onChange={(event) => setTone(event.target.value)} placeholder="clear, calm, expert, warm" />
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autopublishEnabled} onChange={(event) => setAutopublishEnabled(event.target.checked)} />
              Enable scheduled publishing
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={loading || seedTopic.trim().length < 3}>
              {loading ? "Creating flow..." : "Continue to generate 50 topics"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
