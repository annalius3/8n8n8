import {
  Prisma,
  SearchConsolePeriod,
  SearchConsoleDevice,
  type Site,
  type SiteSearchConsoleConnection
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPeriodDates,
  listSearchConsoleProperties,
  mapDevice,
  parseSearchConsoleSecret,
  querySearchConsole,
  refreshSearchConsoleAccessToken,
  serializeSearchConsoleSecret,
  tokenNeedsRefresh,
  type SearchConsoleRow,
  type SearchConsoleTokenSecret
} from "@/lib/sites/google-search-console";

const PERIODS: SearchConsolePeriod[] = [
  SearchConsolePeriod.today,
  SearchConsolePeriod.last_7_days,
  SearchConsolePeriod.last_28_days,
  SearchConsolePeriod.last_3_months
];

export type SiteListItem = {
  id: string;
  name: string;
  domain: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
  connectionStatus: "connected" | "not_connected";
  propertyUrl: string | null;
  googleAccountEmail: string | null;
};

export type SiteOverviewAnalytics = {
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

export async function listSites(userId: string) {
  const sites = await prisma.site.findMany({
    where: { userId },
    include: {
      searchConsoleConnection: {
        select: {
          propertyUrl: true,
          googleAccountEmail: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    domain: site.domain,
    notes: site.notes,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    lastSyncAt: site.lastSyncAt,
    connectionStatus: site.searchConsoleConnection?.propertyUrl ? "connected" : "not_connected",
    propertyUrl: site.searchConsoleConnection?.propertyUrl ?? null,
    googleAccountEmail: site.searchConsoleConnection?.googleAccountEmail ?? null
  })) satisfies SiteListItem[];
}

export async function getSiteForUser(siteId: string, userId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, userId },
    include: {
      searchConsoleConnection: true
    }
  });

  if (!site) {
    throw new Error("Site not found");
  }

  return site;
}

export async function createSite(input: {
  userId: string;
  name: string;
  domain: string;
  notes?: string | null;
}) {
  return prisma.site.create({
    data: {
      userId: input.userId,
      name: input.name,
      domain: normalizeDomain(input.domain),
      notes: input.notes?.trim() || null
    }
  });
}

export async function updateSite(input: {
  siteId: string;
  userId: string;
  name?: string;
  domain?: string;
  notes?: string | null;
}) {
  await getSiteForUser(input.siteId, input.userId);

  return prisma.site.update({
    where: { id: input.siteId },
    data: {
      name: input.name,
      domain: input.domain ? normalizeDomain(input.domain) : undefined,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null
    }
  });
}

export async function deleteSite(siteId: string, userId: string) {
  await getSiteForUser(siteId, userId);
  await prisma.site.delete({ where: { id: siteId } });
}

function normalizeDomain(value: string) {
  return value.trim().replace(/\/+$/, "");
}

async function getConnectionOrThrow(siteId: string, userId: string) {
  const connection = await prisma.siteSearchConsoleConnection.findFirst({
    where: {
      siteId,
      userId
    }
  });

  if (!connection) {
    throw new Error("Search Console is not connected");
  }

  return connection;
}

export async function upsertSearchConsoleConnection(input: {
  siteId: string;
  userId: string;
  secret: SearchConsoleTokenSecret;
  googleAccountEmail?: string | null;
}) {
  await getSiteForUser(input.siteId, input.userId);
  const encryptedJson = serializeSearchConsoleSecret(input.secret);
  const tokenExpiresAt = input.secret.expiresAt ? new Date(input.secret.expiresAt) : null;

  const existing = await prisma.siteSearchConsoleConnection.findUnique({
    where: { siteId: input.siteId }
  });

  return existing
    ? prisma.siteSearchConsoleConnection.update({
        where: { siteId: input.siteId },
        data: {
          encryptedJson,
          tokenExpiresAt,
          googleAccountEmail: input.googleAccountEmail ?? existing.googleAccountEmail
        }
      })
    : prisma.siteSearchConsoleConnection.create({
        data: {
          siteId: input.siteId,
          userId: input.userId,
          encryptedJson,
          tokenExpiresAt,
          googleAccountEmail: input.googleAccountEmail ?? null
        }
      });
}

export async function disconnectSearchConsole(siteId: string, userId: string) {
  await getSiteForUser(siteId, userId);
  await prisma.siteSearchConsoleConnection.deleteMany({
    where: {
      siteId,
      userId
    }
  });
}

export async function getSearchConsoleAccess(siteId: string, userId: string) {
  const connection = await getConnectionOrThrow(siteId, userId);
  let secret = parseSearchConsoleSecret(connection.encryptedJson);

  if (tokenNeedsRefresh(secret)) {
    secret = await refreshSearchConsoleAccessToken(secret);
    await prisma.siteSearchConsoleConnection.update({
      where: { id: connection.id },
      data: {
        encryptedJson: serializeSearchConsoleSecret(secret),
        tokenExpiresAt: secret.expiresAt ? new Date(secret.expiresAt) : null
      }
    });
  }

  return {
    connection,
    secret
  };
}

export async function getAvailableSearchConsoleProperties(siteId: string, userId: string) {
  await getSiteForUser(siteId, userId);
  const { secret } = await getSearchConsoleAccess(siteId, userId);
  return listSearchConsoleProperties(secret.accessToken);
}

export async function attachSearchConsoleProperty(input: {
  siteId: string;
  userId: string;
  propertyUrl: string;
  googleAccountEmail?: string | null;
}) {
  const connection = await getConnectionOrThrow(input.siteId, input.userId);
  return prisma.siteSearchConsoleConnection.update({
    where: { id: connection.id },
    data: {
      propertyUrl: input.propertyUrl,
      googleAccountEmail: input.googleAccountEmail ?? connection.googleAccountEmail
    }
  });
}

function rowToMetric(row: SearchConsoleRow) {
  return {
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0)
  };
}

async function syncDailyStats(siteId: string, propertyUrl: string, accessToken: string, days: number) {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(0, days - 1));

  const daily = await querySearchConsole({
    accessToken,
    propertyUrl,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    dimensions: ["date"],
    rowLimit: Math.max(30, days)
  });

  for (const row of daily.rows ?? []) {
    const dateKey = row.keys?.[0];
    if (!dateKey) continue;

    await prisma.siteSearchConsoleDailyStat.upsert({
      where: {
        siteId_date: {
          siteId,
          date: new Date(`${dateKey}T00:00:00.000Z`)
        }
      },
      create: {
        siteId,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        ...rowToMetric(row)
      },
      update: rowToMetric(row)
    });
  }
}

async function syncTopDimensions(siteId: string, propertyUrl: string, accessToken: string, period: SearchConsolePeriod) {
  const { startDate, endDate } = getPeriodDates(period);
  const syncedAt = new Date();

  const [queries, pages, countries, devices] = await Promise.all([
    querySearchConsole({ accessToken, propertyUrl, startDate, endDate, dimensions: ["query"], rowLimit: 100 }),
    querySearchConsole({ accessToken, propertyUrl, startDate, endDate, dimensions: ["page"], rowLimit: 100 }),
    querySearchConsole({ accessToken, propertyUrl, startDate, endDate, dimensions: ["country"], rowLimit: 100 }),
    querySearchConsole({ accessToken, propertyUrl, startDate, endDate, dimensions: ["device"], rowLimit: 10 })
  ]);

  const queryRows: Prisma.SiteSearchConsoleQueryCreateManyInput[] = (queries.rows ?? []).flatMap((row) => {
    const query = row.keys?.[0];
    if (!query) return [];
    return [{ siteId, period, query, syncedAt, ...rowToMetric(row) }];
  });

  const pageRows: Prisma.SiteSearchConsolePageCreateManyInput[] = (pages.rows ?? []).flatMap((row) => {
    const pageUrl = row.keys?.[0];
    if (!pageUrl) return [];
    return [{ siteId, period, pageUrl, syncedAt, ...rowToMetric(row) }];
  });

  const countryRows: Prisma.SiteSearchConsoleCountryCreateManyInput[] = (countries.rows ?? []).flatMap((row) => {
    const country = row.keys?.[0];
    if (!country) return [];
    return [{ siteId, period, country, syncedAt, ...rowToMetric(row) }];
  });

  const deviceRows: Prisma.SiteSearchConsoleDeviceMetricCreateManyInput[] = (devices.rows ?? []).map((row) => ({
    siteId,
    period,
    device: mapDevice(row.keys?.[0] ?? ""),
    syncedAt,
    ...rowToMetric(row)
  }));

  await prisma.siteSearchConsoleQuery.deleteMany({ where: { siteId, period } });
  if (queryRows.length) {
    await prisma.siteSearchConsoleQuery.createMany({ data: queryRows });
  }

  await prisma.siteSearchConsolePage.deleteMany({ where: { siteId, period } });
  if (pageRows.length) {
    await prisma.siteSearchConsolePage.createMany({ data: pageRows });
  }

  await prisma.siteSearchConsoleCountry.deleteMany({ where: { siteId, period } });
  if (countryRows.length) {
    await prisma.siteSearchConsoleCountry.createMany({ data: countryRows });
  }

  await prisma.siteSearchConsoleDeviceMetric.deleteMany({ where: { siteId, period } });
  if (deviceRows.length) {
    await prisma.siteSearchConsoleDeviceMetric.createMany({ data: deviceRows });
  }
}

export async function syncSearchConsoleSite(input: {
  siteId: string;
  userId: string;
  initialBackfill?: boolean;
}) {
  const site = await getSiteForUser(input.siteId, input.userId);
  const { connection, secret } = await getSearchConsoleAccess(site.id, input.userId);
  if (!connection.propertyUrl) {
    throw new Error("Search Console property is not attached");
  }

  const dailyDays = input.initialBackfill ? 90 : 28;
  await syncDailyStats(site.id, connection.propertyUrl, secret.accessToken, dailyDays);

  for (const period of PERIODS) {
    await syncTopDimensions(site.id, connection.propertyUrl, secret.accessToken, period);
  }

  await prisma.site.update({
    where: { id: site.id },
    data: {
      lastSyncAt: new Date()
    }
  });

  return {
    siteId: site.id,
    syncedAt: new Date().toISOString()
  };
}

function sumMetrics(rows: Array<{ clicks: number; impressions: number; ctr: number; position: number }>) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = rows.length > 0 ? rows.reduce((sum, row) => sum + row.position, 0) / rows.length : 0;
  return { clicks, impressions, ctr, position };
}

export async function getSiteAnalytics(input: {
  siteId: string;
  userId: string;
  period?: SearchConsolePeriod;
}) {
  const site = await getSiteForUser(input.siteId, input.userId);
  const period = input.period ?? SearchConsolePeriod.last_28_days;
  const { startDate } = getPeriodDates(period);

  const [dailyStats, queries, pages, countries, devices] = await Promise.all([
    prisma.siteSearchConsoleDailyStat.findMany({
      where: {
        siteId: site.id,
        date: { gte: new Date(`${startDate}T00:00:00.000Z`) }
      },
      orderBy: { date: "asc" }
    }),
    prisma.siteSearchConsoleQuery.findMany({ where: { siteId: site.id, period }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }] }),
    prisma.siteSearchConsolePage.findMany({ where: { siteId: site.id, period }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }] }),
    prisma.siteSearchConsoleCountry.findMany({ where: { siteId: site.id, period }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }] }),
    prisma.siteSearchConsoleDeviceMetric.findMany({ where: { siteId: site.id, period }, orderBy: [{ clicks: "desc" }] })
  ]);

  const overview: SiteOverviewAnalytics = {
    summary: sumMetrics(dailyStats),
    daily: dailyStats.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }))
  };

  return {
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      notes: site.notes,
      lastSyncAt: site.lastSyncAt,
      propertyUrl: site.searchConsoleConnection?.propertyUrl ?? null,
      googleAccountEmail: site.searchConsoleConnection?.googleAccountEmail ?? null,
      connectionStatus: site.searchConsoleConnection?.propertyUrl ? "connected" : "not_connected"
    },
    period,
    overview,
    queries,
    pages,
    countries,
    devices
  };
}

export async function runSearchConsoleSyncTick() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 1000 * 60 * 60 * 12);

  const sites = await prisma.site.findMany({
    where: {
      searchConsoleConnection: {
        is: {
          propertyUrl: { not: null }
        }
      },
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lte: staleBefore } }
      ]
    },
    select: {
      id: true,
      userId: true
    },
    orderBy: [
      { lastSyncAt: "asc" },
      { createdAt: "asc" }
    ],
    take: 10
  });

  let synced = 0;
  let failed = 0;

  for (const site of sites) {
    try {
      await syncSearchConsoleSite({
        siteId: site.id,
        userId: site.userId,
        initialBackfill: false
      });
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    checked: sites.length,
    synced,
    failed
  };
}
