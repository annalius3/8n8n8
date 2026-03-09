import { getOptionalServerEnvValue } from "@/lib/env";

export function getRequestOrigin(requestUrl: string) {
  const requestOrigin = new URL(requestUrl).origin;
  const configured = getOptionalServerEnvValue("NEXT_PUBLIC_BASE_URL");
  if (configured) {
    const normalizedConfigured = configured.replace(/\/$/, "");
    const configuredHost = new URL(normalizedConfigured).hostname.toLowerCase();
    const requestHost = new URL(requestOrigin).hostname.toLowerCase();
    const configuredIsLocalhost = configuredHost === "localhost" || configuredHost === "127.0.0.1";
    const requestIsLocalhost = requestHost === "localhost" || requestHost === "127.0.0.1";

    // Never let a checked-in local URL override a real production/staging request origin.
    if (!(configuredIsLocalhost && !requestIsLocalhost)) {
      return normalizedConfigured;
    }
  }

  return requestOrigin;
}

export function joinUrl(base: string, path: string) {
  return new URL(path, `${base.replace(/\/$/, "")}/`).toString();
}
