"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const STEP_OPTIONS = [
  ["schedule", "Расписание"],
  ["rss", "Источник: RSS"],
  ["queue", "Источник: Queue"],
  ["delay", "Пауза"],
  ["template", "Текст по шаблону"],
  ["ai_image_leonardo", "Leonardo image"],
  ["pinterest_publish", "Публикация в Pinterest"],
  ["schedule_trigger", "schedule_trigger (legacy)"],
  ["source_rss", "source_rss (legacy)"],
  ["source_queue", "source_queue (legacy)"],
  ["wait", "wait (legacy)"],
  ["sleep", "sleep (legacy)"],
  ["ai_text", "ai_text (legacy)"],
  ["ai_image", "ai_image (legacy)"],
  ["publish_pinterest", "publish_pinterest (legacy)"]
] as const;

const STEP_HELP: Record<string, string> = {
  schedule: "Шаг хранит cron и ограничения по количеству запусков.",
  rss: "Читает RSS, маппит поля и не берёт уже опубликованные элементы.",
  queue: "Берёт запись из очереди и ставит lock на время обработки.",
  delay: "Полезно для паузы между внешними API вызовами.",
  template: "Собирает pin title и pin description из переменных context.",
  ai_image_leonardo: "Генерирует картинку по prompt_template.",
  pinterest_publish: "Публикует пост и пишет published_items.",
  schedule_trigger: "Старое имя шага schedule.",
  source_rss: "Старое имя шага rss.",
  source_queue: "Старое имя шага queue.",
  wait: "Старое имя шага delay.",
  sleep: "Старое имя шага delay.",
  ai_text: "Старое имя шага template / openai text.",
  ai_image: "Старое имя шага ai_image_leonardo.",
  publish_pinterest: "Старое имя шага pinterest_publish."
};

function inferStepMode(type: string) {
  if (["template", "ai_text"].includes(type)) return "Demo/Real через OPENAI_API_KEY";
  if (["ai_image_leonardo", "ai_image"].includes(type)) return "Demo/Real через LEONARDO_API_KEY";
  if (["pinterest_publish", "publish_pinterest"].includes(type)) return "Сейчас demo stub";
  return null;
}

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
      setError(`config_json шага ${index + 1} должен быть корректным JSON`);
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
      setError("Не удалось сохранить поток");
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
          <CardTitle>Настройки потока</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cron</Label>
              <Input value={cron} onChange={(e) => setCron(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Часовой пояс</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Макс. запусков в день</Label>
              <Input
                type="number"
                min={1}
                value={maxRunsPerDay}
                onChange={(e) => setMaxRunsPerDay(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} /> Включён
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPaused} onChange={(e) => setIsPaused(e.target.checked)} /> Планировщик на паузе
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Шаги потока</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => {
            const modeHint = inferStepMode(step.type);

            return (
              <div key={`${index}-${step.type}`} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>Шаг #{index + 1}</strong>
                      {modeHint ? <Badge variant="outline">{modeHint}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{STEP_HELP[step.type] ?? "Настройте JSON ниже."}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeStep(index)}>
                    Удалить
                  </Button>
                </div>
                <div className="mb-3 space-y-2">
                  <Label>Тип шага</Label>
                  <Select value={step.type} onChange={(e) => updateStep(index, { type: e.target.value })}>
                    {STEP_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>config_json</Label>
                  <Textarea
                    rows={8}
                    defaultValue={JSON.stringify(step.configJson, null, 2)}
                    onBlur={(e) => updateStepConfig(index, e.target.value)}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addStep}>
              Добавить шаг
            </Button>
            <Button type="button" onClick={saveAll} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить поток"}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
