import { getOptionalServerEnvValue } from "@/lib/env";

export function getRequestOrigin(requestUrl: string) {
  const configured = getOptionalServerEnvValue("NEXT_PUBLIC_BASE_URL");
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return new URL(requestUrl).origin;
}

export function joinUrl(base: string, path: string) {
  return new URL(path, `${base.replace(/\/$/, "")}/`).toString();
}
