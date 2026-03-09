"use client";

import { useMemo, useState } from "react";
import { Search, RefreshCw, Plus, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";

type SiteRow = {
  id: string;
  name: string;
  domain: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
  connectionStatus: "connected" | "not_connected";
  propertyUrl: string | null;
  googleAccountEmail: string | null;
};

export function SitesManager({ initialSites }: { initialSites: SiteRow[] }) {
  const [sites, setSites] = useState(initialSites);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sites.filter((site) => {
      const matchesQuery =
        !query ||
        site.name.toLowerCase().includes(query.toLowerCase()) ||
        site.domain.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" || site.connectionStatus === status;
      return matchesQuery && matchesStatus;
    });
  }, [sites, query, status]);

  async function syncSite(siteId: string) {
    setBusyId(siteId);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/search-console/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialBackfill: false })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось синхронизировать сайт");
      }
      setSites((current) =>
        current.map((site) => (site.id === siteId ? { ...site, lastSyncAt: data.syncedAt } : site))
      );
      setMessage("Синхронизация завершена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка синхронизации");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSite(siteId: string) {
    if (!window.confirm("Удалить сайт и все связанные данные Search Console?")) {
      return;
    }

    setBusyId(siteId);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Не удалось удалить сайт");
      }
      setSites((current) => current.filter((site) => site.id !== siteId));
      setMessage("Сайт удален.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка удаления");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle>Сайты</CardTitle>
          <p className="text-sm text-muted-foreground">Храните свои сайты, подключайте Search Console и смотрите SEO-метрики в одном месте.</p>
        </div>
        <LinkButton href="/sites/new">
          <Plus className="mr-2 h-4 w-4" />
          Добавить сайт
        </LinkButton>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию или домену" className="pl-9" />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Все статусы</option>
            <option value="connected">Подключен</option>
            <option value="not_connected">Не подключен</option>
          </Select>
        </div>

        {message ? <div className="rounded-xl border px-4 py-3 text-sm">{message}</div> : null}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-medium">Сайты пока не добавлены</p>
            <p className="mt-2 text-sm text-muted-foreground">Добавьте первый сайт и подключите Google Search Console, чтобы начать собирать аналитику.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((site) => (
              <div key={site.id} className="rounded-2xl border bg-background p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{site.name}</div>
                    <div className="text-sm text-muted-foreground">{site.domain}</div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      site.connectionStatus === "connected"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {site.connectionStatus === "connected" ? "Подключен" : "Не подключен"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <div>Добавлен: {new Date(site.createdAt).toLocaleString("ru-RU")}</div>
                  <div>Последняя синхронизация: {site.lastSyncAt ? new Date(site.lastSyncAt).toLocaleString("ru-RU") : "еще не запускалась"}</div>
                  <div>Property: {site.propertyUrl ?? "не выбрана"}</div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <LinkButton href={`/sites/${site.id}`} size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Открыть
                  </LinkButton>
                  <Button size="sm" variant="outline" disabled={busyId === site.id} onClick={() => syncSite(site.id)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Синхронизировать
                  </Button>
                  <LinkButton href={`/sites/${site.id}/edit`} size="sm" variant="outline">
                    <Pencil className="mr-2 h-4 w-4" />
                    Редактировать
                  </LinkButton>
                  <Button size="sm" variant="outline" disabled={busyId === site.id} onClick={() => deleteSite(site.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
