"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PlatformSetting = {
  platform: string;
  enabled: boolean;
  maxPostsPerDay: number;
  minIntervalMinutes: number;
  requireApproval: boolean;
};

type ArticleRow = {
  id: string;
  title: string;
  category: string | null;
  canonicalUrl: string;
  publishedAt: string;
  autopostEnabled: boolean;
  jobs: Array<{
    id: string;
    platform: string;
    status: string;
    scheduledAt: string | null;
    publishedAt: string | null;
    errorMessage: string | null;
    externalPostId: string | null;
  }>;
};

type DashboardProps = {
  sourceConfig: {
    rssUrl: string | null;
    enabled: boolean;
    immediatePublishEnabled: boolean;
    assetsPersistenceEnabled: boolean;
    lastScannedAt: string | null;
  } | null;
  platformSettings: PlatformSetting[];
  articles: ArticleRow[];
  jobsByStatus: Array<{ status: string; _count: number }>;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU");
}

function statusLabel(status: string) {
  if (status === "published") return { text: "Опубликовано", variant: "default" as const };
  if (status === "failed") return { text: "Ошибка", variant: "destructive" as const };
  if (status === "publishing") return { text: "Публикуется", variant: "secondary" as const };
  if (status === "generated") return { text: "Готово к постингу", variant: "outline" as const };
  if (status === "scheduled") return { text: "Запланировано", variant: "outline" as const };
  if (status === "skipped") return { text: "Пропущено", variant: "secondary" as const };
  return { text: status, variant: "outline" as const };
}

async function callJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}

export function AutoPostManager({ initialData }: { initialData: DashboardProps }) {
  const [data, setData] = useState(initialData);
  const [rssUrl, setRssUrl] = useState(initialData.sourceConfig?.rssUrl ?? "");
  const [platformDrafts, setPlatformDrafts] = useState<Record<string, { maxPostsPerDay: number; minIntervalMinutes: number }>>(
    Object.fromEntries(
      initialData.platformSettings.map((item) => [
        item.platform,
        { maxPostsPerDay: item.maxPostsPerDay, minIntervalMinutes: item.minIntervalMinutes }
      ])
    )
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [query, setQuery] = useState("");

  const filteredArticles = useMemo(() => {
    if (!query.trim()) return data.articles;
    const q = query.trim().toLowerCase();
    return data.articles.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q) ||
        item.canonicalUrl.toLowerCase().includes(q)
    );
  }, [data.articles, query]);

  const refresh = async () => {
    const payload = await callJson("/api/autopost/status/all").catch(() => null);
    if (payload?.dashboard) {
      setData(payload.dashboard as DashboardProps);
      setPlatformDrafts(
        Object.fromEntries(
          (payload.dashboard as DashboardProps).platformSettings.map((item) => [
            item.platform,
            { maxPostsPerDay: item.maxPostsPerDay, minIntervalMinutes: item.minIntervalMinutes }
          ])
        )
      );
    } else {
      window.location.reload();
    }
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    try {
      setBusy(key);
      setMessage("");
      await fn();
      setMessage("Готово");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Сканер новых статей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">RSS URL</span>
              <Input value={rssUrl} onChange={(event) => setRssUrl(event.target.value)} />
            </label>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p>Последний скан: {formatDate(data.sourceConfig?.lastScannedAt ?? null)}</p>
              <p>Immediate publish: {data.sourceConfig?.immediatePublishEnabled ? "вкл" : "выкл"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null}
              onClick={() =>
                runAction("source-save", async () => {
                  await callJson("/api/autopost/settings/source", {
                    method: "POST",
                    body: JSON.stringify({
                      rssUrl,
                      enabled: true
                    })
                  });
                })
              }
            >
              Сохранить источник
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                runAction("scan", async () => {
                  await callJson("/api/autopost/scan", { method: "POST" });
                })
              }
            >
              Сканировать и добавить статьи
            </Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Настройки платформ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.platformSettings.map((setting) => (
              <div key={setting.platform} className="grid gap-3 rounded-lg border p-3 md:grid-cols-6 md:items-center">
                <div className="font-medium">{setting.platform}</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    onChange={(event) =>
                      runAction(`platform-${setting.platform}`, async () => {
                        await callJson("/api/autopost/settings/platform", {
                          method: "POST",
                          body: JSON.stringify({
                            platform: setting.platform,
                            enabled: event.target.checked
                          })
                        });
                      })
                    }
                  />
                  enable
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">max/day</span>
                  <Input
                    type="number"
                    min={1}
                    value={platformDrafts[setting.platform]?.maxPostsPerDay ?? setting.maxPostsPerDay}
                    onChange={(event) =>
                      setPlatformDrafts((prev) => ({
                        ...prev,
                        [setting.platform]: {
                          maxPostsPerDay: Number(event.target.value || setting.maxPostsPerDay),
                          minIntervalMinutes: prev[setting.platform]?.minIntervalMinutes ?? setting.minIntervalMinutes
                        }
                      }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">interval (min)</span>
                  <Input
                    type="number"
                    min={1}
                    value={platformDrafts[setting.platform]?.minIntervalMinutes ?? setting.minIntervalMinutes}
                    onChange={(event) =>
                      setPlatformDrafts((prev) => ({
                        ...prev,
                        [setting.platform]: {
                          maxPostsPerDay: prev[setting.platform]?.maxPostsPerDay ?? setting.maxPostsPerDay,
                          minIntervalMinutes: Number(event.target.value || setting.minIntervalMinutes)
                        }
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={setting.requireApproval}
                    onChange={(event) =>
                      runAction(`approval-${setting.platform}`, async () => {
                        await callJson("/api/autopost/settings/platform", {
                          method: "POST",
                          body: JSON.stringify({
                            platform: setting.platform,
                            requireApproval: event.target.checked
                          })
                        });
                      })
                    }
                  />
                  manual approval
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    runAction(`limits-${setting.platform}`, async () => {
                      await callJson("/api/autopost/settings/platform", {
                        method: "POST",
                          body: JSON.stringify({
                            platform: setting.platform,
                            maxPostsPerDay: platformDrafts[setting.platform]?.maxPostsPerDay ?? setting.maxPostsPerDay,
                            minIntervalMinutes: platformDrafts[setting.platform]?.minIntervalMinutes ?? setting.minIntervalMinutes
                          })
                        });
                      })
                  }
                >
                  Применить
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Статьи и автопостинг</CardTitle>
          <div className="flex flex-wrap gap-2">
            {data.jobsByStatus.map((item) => (
              <span key={item.status} className="rounded-md border px-2 py-1 text-xs">
                {item.status}: {item._count}
              </span>
            ))}
          </div>
          <Input
            placeholder="Фильтр по заголовку, категории, URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статья</TableHead>
                <TableHead>Опции</TableHead>
              <TableHead>Статусы платформ</TableHead>
              <TableHead>План / публикация</TableHead>
              <TableHead>Ошибки</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {filteredArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{article.title}</p>
                      <p className="text-xs text-muted-foreground">{article.category ?? "без категории"}</p>
                      <a href={article.canonicalUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                        {article.canonicalUrl}
                      </a>
                      <p className="text-xs text-muted-foreground">Published: {formatDate(article.publishedAt)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(`gen-${article.id}`, async () => {
                            await callJson(`/api/autopost/generate/${article.id}`, { method: "POST" });
                          })
                        }
                      >
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(`pub-${article.id}`, async () => {
                            await callJson(`/api/autopost/publish/${article.id}`, { method: "POST" });
                          })
                        }
                      >
                        Publish
                      </Button>
                      <Button
                        size="sm"
                        variant={article.autopostEnabled ? "secondary" : "outline"}
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(`toggle-${article.id}`, async () => {
                            await callJson(`/api/autopost/article/${article.id}/toggle`, {
                              method: "POST",
                              body: JSON.stringify({
                                enabled: !article.autopostEnabled
                              })
                            });
                          })
                        }
                      >
                        {article.autopostEnabled ? "Disable autopost" : "Enable autopost"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction(`regen-${article.id}`, async () => {
                            await callJson(`/api/autopost/article/${article.id}/regenerate`, { method: "POST" });
                          })
                        }
                      >
                        Regenerate only
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      {article.jobs.map((job) => {
                        const label = statusLabel(job.status);
                        return (
                          <Button
                            key={job.id}
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() =>
                              runAction(`pub-${job.id}`, async () => {
                                await callJson(`/api/autopost/publish/${article.id}/${job.platform}`, { method: "POST" });
                              })
                            }
                          >
                            {job.platform}: {label.text}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">
                    {article.jobs.map((job) => (
                      <p key={`${job.id}-schedule`}>
                        {job.platform}: plan {formatDate(job.scheduledAt)} / pub {formatDate(job.publishedAt)}
                        {job.externalPostId ? ` / id ${job.externalPostId}` : ""}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell className="align-top text-xs text-red-600">
                    {article.jobs
                      .filter((job) => job.errorMessage)
                      .map((job) => (
                        <p key={`${job.id}-err`}>{job.platform}: {job.errorMessage}</p>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
