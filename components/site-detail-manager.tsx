"use client";

import { useMemo, useState } from "react";
import { SearchConsolePeriod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LinkButton } from "@/components/ui/link-button";
import { SiteOverviewChart } from "@/components/site-overview-chart";

type AnalyticsPayload = {
  site: {
    id: string;
    name: string;
    domain: string;
    notes: string | null;
    lastSyncAt: string | null;
    propertyUrl: string | null;
    googleAccountEmail: string | null;
    connectionStatus: "connected" | "not_connected";
  };
  period: SearchConsolePeriod;
  overview: {
    summary: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    daily: Array<{
      date: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  pages: Array<{ pageUrl: string; clicks: number; impressions: number; ctr: number; position: number }>;
  countries: Array<{ country: string; clicks: number; impressions: number; ctr: number; position: number }>;
  devices: Array<{ device: string; clicks: number; impressions: number; ctr: number; position: number }>;
};

type PropertyOption = {
  siteUrl: string;
  permissionLevel: string | null;
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function DataTable({
  headers,
  rows
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SiteDetailManager({
  initialAnalytics,
  initialTab
}: {
  initialAnalytics: AnalyticsPayload;
  initialTab: string;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [tab, setTab] = useState(initialTab);
  const [period, setPeriod] = useState<SearchConsolePeriod>(initialAnalytics.period);
  const [message, setMessage] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState(initialAnalytics.site.propertyUrl ?? "");
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queryFilter, setQueryFilter] = useState("");

  async function reloadAnalytics(nextPeriod = period) {
    const response = await fetch(`/api/sites/${analytics.site.id}/analytics?period=${nextPeriod}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Не удалось загрузить аналитику");
    }
    setAnalytics(data);
  }

  async function syncNow(initialBackfill = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${analytics.site.id}/search-console/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialBackfill })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось синхронизировать сайт");
      }
      await reloadAnalytics();
      setMessage("Синхронизация завершена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка синхронизации");
    } finally {
      setBusy(false);
    }
  }

  async function loadProperties() {
    setLoadingProperties(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${analytics.site.id}/search-console/properties`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось загрузить properties");
      }
      setProperties(data.properties ?? []);
      setMessage("Список properties обновлен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки properties");
    } finally {
      setLoadingProperties(false);
    }
  }

  async function attachProperty() {
    if (!selectedProperty) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${analytics.site.id}/search-console/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyUrl: selectedProperty })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось привязать property");
      }
      await reloadAnalytics();
      setMessage("Property привязана.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка привязки property");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Отключить Search Console от этого сайта?")) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sites/${analytics.site.id}/search-console/disconnect`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось отключить Search Console");
      }
      await reloadAnalytics();
      setProperties([]);
      setSelectedProperty("");
      setMessage("Search Console отключен.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка отключения");
    } finally {
      setBusy(false);
    }
  }

  const filteredQueries = useMemo(() => {
    return analytics.queries.filter((item) => item.query.toLowerCase().includes(queryFilter.toLowerCase()));
  }, [analytics.queries, queryFilter]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "queries", label: "Queries" },
    { id: "pages", label: "Pages" },
    { id: "countries", label: "Countries" },
    { id: "devices", label: "Devices" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>{analytics.site.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{analytics.site.domain}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={period}
              onChange={async (event) => {
                const nextPeriod = event.target.value as SearchConsolePeriod;
                setPeriod(nextPeriod);
                await reloadAnalytics(nextPeriod);
              }}
            >
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_28_days">Last 28 days</option>
              <option value="last_3_months">Last 3 months</option>
            </Select>
            <Button variant="outline" disabled={busy} onClick={() => syncNow(false)}>
              Sync now
            </Button>
            <LinkButton href={`/sites/${analytics.site.id}/edit`} variant="outline">Редактировать</LinkButton>
            <LinkButton href="/sites" variant="outline">К списку сайтов</LinkButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <Button key={item.id} variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
                {item.label}
              </Button>
            ))}
          </div>
          {message ? <div className="rounded-xl border px-4 py-3 text-sm">{message}</div> : null}
        </CardContent>
      </Card>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Clicks" value={Math.round(analytics.overview.summary.clicks).toLocaleString("ru-RU")} />
            <MetricCard label="Impressions" value={Math.round(analytics.overview.summary.impressions).toLocaleString("ru-RU")} />
            <MetricCard label="CTR" value={`${(analytics.overview.summary.ctr * 100).toFixed(2)}%`} />
            <MetricCard label="Average position" value={analytics.overview.summary.position.toFixed(2)} />
          </div>
          <SiteOverviewChart data={analytics.overview.daily.map((item) => ({ date: item.date, clicks: item.clicks, impressions: item.impressions }))} />
        </div>
      ) : null}

      {tab === "queries" ? (
        <div className="space-y-4">
          <Input value={queryFilter} onChange={(event) => setQueryFilter(event.target.value)} placeholder="Фильтр по поисковому запросу" />
          <DataTable
            headers={["Query", "Clicks", "Impressions", "CTR", "Position"]}
            rows={filteredQueries.map((row) => [
              row.query,
              Math.round(row.clicks).toString(),
              Math.round(row.impressions).toString(),
              `${(row.ctr * 100).toFixed(2)}%`,
              row.position.toFixed(2)
            ])}
          />
        </div>
      ) : null}

      {tab === "pages" ? (
        <DataTable
          headers={["Page URL", "Clicks", "Impressions", "CTR", "Position"]}
          rows={analytics.pages.map((row) => [
            row.pageUrl,
            Math.round(row.clicks).toString(),
            Math.round(row.impressions).toString(),
            `${(row.ctr * 100).toFixed(2)}%`,
            row.position.toFixed(2)
          ])}
        />
      ) : null}

      {tab === "countries" ? (
        <DataTable
          headers={["Country", "Clicks", "Impressions", "CTR", "Position"]}
          rows={analytics.countries.map((row) => [
            row.country,
            Math.round(row.clicks).toString(),
            Math.round(row.impressions).toString(),
            `${(row.ctr * 100).toFixed(2)}%`,
            row.position.toFixed(2)
          ])}
        />
      ) : null}

      {tab === "devices" ? (
        <DataTable
          headers={["Device", "Clicks", "Impressions", "CTR", "Position"]}
          rows={analytics.devices.map((row) => [
            row.device,
            Math.round(row.clicks).toString(),
            Math.round(row.impressions).toString(),
            `${(row.ctr * 100).toFixed(2)}%`,
            row.position.toFixed(2)
          ])}
        />
      ) : null}

      {tab === "settings" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Search Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">Статус: {analytics.site.connectionStatus === "connected" ? "Connected" : "Not connected"}</div>
              <div className="text-sm text-muted-foreground">Property: {analytics.site.propertyUrl ?? "не выбрана"}</div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/sites/${analytics.site.id}/search-console/connect`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  Подключить Google
                </a>
                <Button variant="outline" disabled={loadingProperties} onClick={loadProperties}>
                  {loadingProperties ? "Загрузка..." : "Загрузить properties"}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => syncNow(true)}>
                  Первая синхронизация
                </Button>
                <Button variant="outline" disabled={busy} onClick={disconnect}>
                  Отключить Search Console
                </Button>
              </div>

              {properties.length > 0 ? (
                <div className="space-y-3 rounded-xl border p-4">
                  <Select value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)}>
                    <option value="">Выберите property</option>
                    {properties.map((property) => (
                      <option key={property.siteUrl} value={property.siteUrl}>
                        {property.siteUrl}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={attachProperty} disabled={!selectedProperty || busy}>
                    Привязать property
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>Домен: {analytics.site.domain}</div>
              <div>Notes: {analytics.site.notes || "—"}</div>
              <div>Google account email: {analytics.site.googleAccountEmail || "не доступен"}</div>
              <div>Последняя синхронизация: {analytics.site.lastSyncAt ? new Date(analytics.site.lastSyncAt).toLocaleString("ru-RU") : "еще не запускалась"}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
