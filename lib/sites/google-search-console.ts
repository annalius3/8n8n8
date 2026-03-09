import { SearchConsoleDevice, SearchConsolePeriod } from "@prisma/client";
import { createSignedStateToken, verifySignedStateToken } from "@/lib/auth";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getOptionalServerEnvValue } from "@/lib/env";

export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export type SearchConsoleOAuthState = {
  provider: "google_search_console";
  userId: string;
  siteId: string;
  next?: string;
};

export type SearchConsoleTokenSecret = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  accountEmail?: string | null;
};

export type SearchConsoleRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchConsoleResponse = {
  rows?: SearchConsoleRow[];
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type SiteEntry = {
  siteUrl: string;
  permissionLevel?: string;
};

function getClientId() {
  return getOptionalServerEnvValue("GOOGLE_SEARCH_CONSOLE_CLIENT_ID") ?? getOptionalServerEnvValue("GOOGLE_CLIENT_ID");
}

function getClientSecret() {
  return (
    getOptionalServerEnvValue("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET") ??
    getOptionalServerEnvValue("GOOGLE_CLIENT_SECRET")
  );
}

export function ensureSearchConsoleOAuthConfigured() {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google Search Console OAuth is not configured");
  }

  return { clientId, clientSecret };
}

export function createSearchConsoleStateToken(payload: Omit<SearchConsoleOAuthState, "provider">) {
  return createSignedStateToken({
    provider: "google_search_console",
    ...payload
  });
}

export function verifySearchConsoleStateToken(token: string) {
  return verifySignedStateToken<SearchConsoleOAuthState>(token);
}

export function parseSearchConsoleSecret(encryptedJson: string): SearchConsoleTokenSecret {
  return JSON.parse(decryptToken(encryptedJson)) as SearchConsoleTokenSecret;
}

export function serializeSearchConsoleSecret(secret: SearchConsoleTokenSecret) {
  return encryptToken(JSON.stringify(secret));
}

export function buildSearchConsoleAuthUrl(input: { redirectUri: string; state: string }) {
  const { clientId } = ensureSearchConsoleOAuthConfigured();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SEARCH_CONSOLE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeSearchConsoleCode(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = ensureSearchConsoleOAuthConfigured();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    expiresAt: typeof data.expires_in === "number" ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined
  } satisfies SearchConsoleTokenSecret;
}

export async function refreshSearchConsoleAccessToken(secret: SearchConsoleTokenSecret) {
  if (!secret.refreshToken) {
    throw new Error("Google refresh token is missing");
  }

  const { clientId, clientSecret } = ensureSearchConsoleOAuthConfigured();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: secret.refreshToken,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token refresh failed");
  }

  return {
    ...secret,
    accessToken: data.access_token,
    tokenType: data.token_type ?? secret.tokenType,
    expiresAt: typeof data.expires_in === "number" ? new Date(Date.now() + data.expires_in * 1000).toISOString() : secret.expiresAt
  } satisfies SearchConsoleTokenSecret;
}

export function tokenNeedsRefresh(secret: SearchConsoleTokenSecret) {
  if (!secret.expiresAt) {
    return false;
  }
  return new Date(secret.expiresAt).getTime() <= Date.now() + 60_000;
}

async function googleApiRequest<T>(input: { accessToken: string; url: string; init?: RequestInit }) {
  const response = await fetch(input.url, {
    ...input.init,
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      ...(input.init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Search Console API error ${response.status}: ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export async function listSearchConsoleProperties(accessToken: string) {
  const data = await googleApiRequest<{ siteEntry?: SiteEntry[] }>({
    accessToken,
    url: "https://www.googleapis.com/webmasters/v3/sites"
  });

  return (data.siteEntry ?? []).map((item) => ({
    siteUrl: item.siteUrl,
    permissionLevel: item.permissionLevel ?? null
  }));
}

export function getPeriodDates(period: SearchConsolePeriod) {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);

  switch (period) {
    case SearchConsolePeriod.today:
      break;
    case SearchConsolePeriod.last_7_days:
      startDate.setUTCDate(startDate.getUTCDate() - 6);
      break;
    case SearchConsolePeriod.last_28_days:
      startDate.setUTCDate(startDate.getUTCDate() - 27);
      break;
    case SearchConsolePeriod.last_3_months:
      startDate.setUTCDate(startDate.getUTCDate() - 89);
      break;
    default:
      startDate.setUTCDate(startDate.getUTCDate() - 27);
  }

  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10)
  };
}

export async function querySearchConsole(input: {
  accessToken: string;
  propertyUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}) {
  const siteUrl = encodeURIComponent(input.propertyUrl);

  return googleApiRequest<SearchConsoleResponse>({
    accessToken: input.accessToken,
    url: `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    init: {
      method: "POST",
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        rowLimit: input.rowLimit ?? 100
      })
    }
  });
}

export function mapDevice(device: string) {
  if (device === "DESKTOP" || device === "desktop") return SearchConsoleDevice.desktop;
  if (device === "MOBILE" || device === "mobile") return SearchConsoleDevice.mobile;
  if (device === "TABLET" || device === "tablet") return SearchConsoleDevice.tablet;
  return SearchConsoleDevice.other;
}
