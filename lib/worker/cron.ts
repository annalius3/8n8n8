import { CronExpressionParser } from "cron-parser";

export function computeNextRunAt(cron: string, timezone: string, from = new Date()): Date {
  if (cron === "random_daily") {
    return new Date(from.getTime() + 60_000);
  }

  const interval = CronExpressionParser.parse(cron, {
    currentDate: from,
    tz: timezone
  });

  return interval.next().toDate();
}
