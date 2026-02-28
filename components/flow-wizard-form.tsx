"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FlowWizardForm() {
  const [name, setName] = useState("RSS -> Текст -> Leonardo -> Pinterest");
  const [sourceType, setSourceType] = useState<"rss" | "queue">("rss");
  const [rssUrl, setRssUrl] = useState("https://hnrss.org/frontpage");
  const [cron, setCron] = useState("0 */6 * * *");
  const [timezone, setTimezone] = useState("Europe/Kiev");
  const [maxRunsPerDay, setMaxRunsPerDay] = useState(10);
  const [textTemplate, setTextTemplate] = useState("Read more: {link_url}\n\n{summary}\n\n{hashtags}");
  const [imagePromptTemplate, setImagePromptTemplate] = useState(
    "Minimal cozy aesthetic photo representing: {title}. Soft light, high quality, no text, no watermark."
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const preview = useMemo(() => {
    const sample = {
      title: "Morning routine ideas for calm energy",
      summary: "A short article about building a quiet morning routine that supports focus and wellbeing.",
      link_url: sourceType === "rss" ? rssUrl : "https://example.com/queue-item",
      hashtags: "#energy #healing #mindfulness"
    };

    return {
      pinTitle: `${sample.title} - quick guide`,
      pinDescription: textTemplate
        .replaceAll("{title}", sample.title)
        .replaceAll("{summary}", sample.summary)
        .replaceAll("{link_url}", sample.link_url)
        .replaceAll("{hashtags}", sample.hashtags),
      imagePrompt: imagePromptTemplate
        .replaceAll("{title}", sample.title)
        .replaceAll("{summary}", sample.summary)
        .replaceAll("{link_url}", sample.link_url)
        .replaceAll("{image_prompt}", "soft healing lifestyle scene")
    };
  }, [imagePromptTemplate, rssUrl, sourceType, textTemplate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sourceType,
        rssUrl,
        cron,
        timezone,
        maxRunsPerDay,
        textTemplate,
        imagePromptTemplate
      })
    });

    if (!response.ok) {
      setError("Не удалось создать поток");
      setLoading(false);
      return;
    }

    const created = (await response.json()) as { id: string };
    router.push(`/flows/${created.id}`);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Создание потока</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Название потока</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Тип источника</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as "rss" | "queue")}
              >
                <option value="rss">RSS</option>
                <option value="queue">Очередь (БД)</option>
              </select>
            </div>
            {sourceType === "rss" ? (
              <div className="space-y-2">
                <Label>RSS URL</Label>
                <Input value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} required />
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Cron</Label>
                <Input value={cron} onChange={(e) => setCron(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Часовой пояс</Label>
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Макс. запусков в день</Label>
                <Input
                  type="number"
                  value={maxRunsPerDay}
                  min={1}
                  onChange={(e) => setMaxRunsPerDay(Number(e.target.value) || 1)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Шаблон описания поста</Label>
              <Textarea rows={4} value={textTemplate} onChange={(e) => setTextTemplate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Шаблон prompt для Leonardo</Label>
              <Textarea rows={3} value={imagePromptTemplate} onChange={(e) => setImagePromptTemplate(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Создание..." : "Создать поток"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Источник</p>
            <p className="mt-1 text-sm font-medium">{sourceType === "rss" ? `RSS: ${rssUrl}` : "Очередь из базы данных"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Будущий заголовок</p>
            <p className="mt-1 text-sm font-medium">{preview.pinTitle}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Будущее описание</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{preview.pinDescription}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Prompt для картинки</p>
            <p className="mt-1 text-sm text-muted-foreground">{preview.imagePrompt}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Расписание</p>
            <p className="mt-1 text-sm font-medium">{cron}</p>
            <p className="text-xs text-muted-foreground">{timezone} · до {maxRunsPerDay} запусков в день</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
