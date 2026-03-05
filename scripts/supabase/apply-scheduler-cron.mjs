import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const templatePath = resolve(process.cwd(), "scripts/supabase/setup_scheduler_cron.sql");
const template = readFileSync(templatePath, "utf8");

const appUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
const schedulerToken = (process.env.SCHEDULER_TOKEN || "").trim();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!appUrl) {
  console.error("APP_BASE_URL (or NEXT_PUBLIC_BASE_URL) is required");
  process.exit(1);
}

if (!schedulerToken) {
  console.error("SCHEDULER_TOKEN is required");
  process.exit(1);
}

const sql = template
  .replaceAll("https://YOUR_APP_URL", appUrl)
  .replaceAll("YOUR_SCHEDULER_TOKEN", schedulerToken);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
  {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Supabase scheduler cron configured successfully.");
