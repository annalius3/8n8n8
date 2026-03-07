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
  if (status === "published") return { text: "Опубликовано", tone: "text-emerald-700" };
  if (status === "failed") return { text: "Ошибка", tone: "text-red-600" };
  if (status === "publishing") return { text: "Публикуется", tone: "text-amber-700" };
  if (status === "generated") return { text: "Готово к публикации", tone: "text-sky-700" };
  if (status === "scheduled") return { text: "Запланировано", tone: "text-violet-700" };
  if (status === "skipped") return { text: "Пропущено", tone: "text-slate-600" };
  if (status === "pending") return { text: "Ожидает генерацию", tone: "text-slate-600" };
  return { text: status, tone: "text-slate-600" };
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
  const [platformDrafts, setPlatformDrafts] = useState<
    Record<string, { maxPostsPerDay: number; minIntervalMinutes: number }>
  >(
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
    if (!payload?.dashboard) {
      window.location.reload();
      return;
    }

    const nextData = payload.dashboard as DashboardProps;
    setData(nextData);
    setPlatformDrafts(
      Object.fromEntries(
        nextData.platformSettings.map((item) => [
          item.platform,
          { maxPostsPerDay: item.maxPostsPerDay, minIntervalMinutes: item.minIntervalMinutes }
        ])
      )
    );
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
          <CardTitle>Источник статей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">RSS URL</span>
              <Input value={rssUrl} onChange={(event) => setRssUrl(event.target.value)} />
            </label>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p>Последний скан: {formatDate(data.sourceConfig?.lastScannedAt ?? null)}</p>
              <p>Мгновенная публикация: {data.sourceConfig?.immediatePublishEnabled ? "включена" : "выключена"}</p>
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
        <CardContent className="space-y-3">
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
                включено
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">постов в день</span>
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
                <span className="text-muted-foreground">интервал, мин</span>
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
                ручное подтверждение
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
            placeholder="Фильтр по заголовку, категории или URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статья</TableHead>
                <TableHead>Действия</TableHead>
                <TableHead>Платформы</TableHead>
                <TableHead>План / факт</TableHead>
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
                      <p className="text-xs text-muted-foreground">Опубликована на сайте: {formatDate(article.publishedAt)}</p>
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
                        {article.autopostEnabled ? "Выключить автопостинг" : "Включить автопостинг"}
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
                        Перегенерировать без публикации
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="space-y-2">
                      {article.jobs.map((job) => {
                        const label = statusLabel(job.status);
                        return (
                          <div key={job.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                            <div className="text-xs">
                              <p className="font-medium">{job.platform}</p>
                              <p className={label.tone}>{label.text}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() =>
                                runAction(`pub-${job.id}`, async () => {
                                  await callJson(`/api/autopost/publish/${article.id}/${job.platform}`, {
                                    method: "POST"
                                  });
                                })
                              }
                            >
                              Опубликовать
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>

                  <TableCell className="align-top text-xs text-muted-foreground">
                    {article.jobs.map((job) => (
                      <p key={`${job.id}-schedule`}>
                        {job.platform}: план {formatDate(job.scheduledAt)} / пост {formatDate(job.publishedAt)}
                        {job.externalPostId ? ` / id ${job.externalPostId}` : ""}
                      </p>
                    ))}
                  </TableCell>

                  <TableCell className="align-top text-xs text-red-600">
                    {article.jobs
                      .filter((job) => job.errorMessage)
                      .map((job) => (
                        <p key={`${job.id}-error`}>
                          {job.platform}: {job.errorMessage}
                        </p>
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
