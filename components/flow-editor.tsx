"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

type StepItem = {
  type: string;
  configJson: Record<string, unknown>;
};

type FlowEditorProps = {
  flowId: string;
  initialName: string;
  initialEnabled: boolean;
  initialCron: string;
  initialTimezone: string;
  initialMaxRunsPerDay: number;
  initialIsPaused: boolean;
  initialSteps: Array<{ type: string; configJson: Record<string, unknown> }>;
};

export function FlowEditor({
  flowId,
  initialName,
  initialEnabled,
  initialCron,
  initialTimezone,
  initialMaxRunsPerDay,
  initialIsPaused,
  initialSteps
}: FlowEditorProps) {
  const [name, setName] = useState(initialName);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [cron, setCron] = useState(initialCron);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [maxRunsPerDay, setMaxRunsPerDay] = useState(initialMaxRunsPerDay);
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [steps, setSteps] = useState<StepItem[]>(initialSteps);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function updateStep(index: number, patch: Partial<StepItem>) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function updateStepConfig(index: number, configText: string) {
    try {
      const parsed = JSON.parse(configText) as Record<string, unknown>;
      updateStep(index, { configJson: parsed });
      setError(null);
    } catch {
      setError("Step config must be valid JSON");
    }
  }

  function addStep() {
    setSteps((prev) => [...prev, { type: "template", configJson: { pin_title_template: "{title}" } }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveAll() {
    setSaving(true);
    setError(null);

    const metaResponse = await fetch(`/api/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isEnabled, cron, timezone, maxRunsPerDay, isPaused })
    });

    const stepsResponse = await fetch(`/api/flows/${flowId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps })
    });

    if (!metaResponse.ok || !stepsResponse.ok) {
      setError("Failed to save flow");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Flow Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cron</Label>
              <Input value={cron} onChange={(e) => setCron(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max runs/day</Label>
              <Input
                type="number"
                min={1}
                value={maxRunsPerDay}
                onChange={(e) => setMaxRunsPerDay(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} /> Enabled
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPaused} onChange={(e) => setIsPaused(e.target.checked)} /> Schedule paused
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flow Steps (ordered list)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <div key={`${index}-${step.type}`} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong>Step #{index + 1}</strong>
                <Button size="sm" variant="outline" onClick={() => removeStep(index)}>
                  Remove
                </Button>
              </div>
              <div className="mb-2 space-y-2">
                <Label>Type</Label>
                <Select value={step.type} onChange={(e) => updateStep(index, { type: e.target.value })}>
                  <option value="schedule">schedule</option>
                  <option value="rss">rss</option>
                  <option value="queue">queue</option>
                  <option value="delay">delay</option>
                  <option value="template">template</option>
                  <option value="ai_image_leonardo">ai_image_leonardo</option>
                  <option value="pinterest_publish">pinterest_publish</option>
                  <option value="schedule_trigger">schedule_trigger (legacy)</option>
                  <option value="source_rss">source_rss (legacy)</option>
                  <option value="source_queue">source_queue (legacy)</option>
                  <option value="wait">wait (legacy)</option>
                  <option value="sleep">sleep (legacy)</option>
                  <option value="ai_text">ai_text (legacy)</option>
                  <option value="ai_image">ai_image (legacy)</option>
                  <option value="publish_pinterest">publish_pinterest (legacy)</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>config_json</Label>
                <Textarea
                  rows={5}
                  defaultValue={JSON.stringify(step.configJson, null, 2)}
                  onBlur={(e) => updateStepConfig(index, e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addStep}>
              Add step
            </Button>
            <Button type="button" onClick={saveAll} disabled={saving}>
              {saving ? "Saving..." : "Save flow"}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
