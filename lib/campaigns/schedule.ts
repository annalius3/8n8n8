import { CronExpressionParser } from "cron-parser";

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const local = new Date(date.toLocaleString("en-US", { timeZone }));
  return local.getTime() - date.getTime();
}

function zonedDateAtTime(baseDate: Date, timeZone: string, hours: number, minutes: number) {
  const local = new Date(baseDate.toLocaleString("en-US", { timeZone }));
  local.setHours(hours, minutes, 0, 0);
  const offset = getTimeZoneOffsetMs(local, timeZone);
  return new Date(local.getTime() - offset);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function computeStartDateFromTime(input: {
  startTime: string;
  timezone: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [startHourRaw, startMinuteRaw] = input.startTime.split(":");
  const startHour = Math.max(0, Math.min(23, Number(startHourRaw ?? 0) || 0));
  const startMinute = Math.max(0, Math.min(59, Number(startMinuteRaw ?? 0) || 0));

  let candidate = zonedDateAtTime(now, input.timezone, startHour, startMinute);
  if (candidate <= now) {
    candidate = zonedDateAtTime(addDays(now, 1), input.timezone, startHour, startMinute);
  }

  return candidate;
}

export function computeScheduledDatesFromIntervalCron(input: {
  count: number;
  cron: string;
  timezone: string;
  now?: Date;
}) {
  const cron = input.cron.trim();
  const supportsIntervalMode =
    /^\*\/\d+\s+\*\s+\*\s+\*\s+\*$/.test(cron) ||
    /^\d+\s+\*\/\d+\s+\*\s+\*\s+\*$/.test(cron) ||
    /^\d+\s+\d+\s+\*\/\d+\s+\*\s+\*$/.test(cron);

  if (!supportsIntervalMode || input.count <= 0) {
    return null;
  }

  const interval = CronExpressionParser.parse(cron, {
    currentDate: input.now ?? new Date(),
    tz: input.timezone
  });

  const output: Date[] = [];
  for (let index = 0; index < input.count; index += 1) {
    output.push(interval.next().toDate());
  }

  return output;
}

export function computeRandomScheduledDates(input: {
  count: number;
  postsPerDay: number;
  timezone: string;
  startTime: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const postsPerDay = Math.max(1, Math.min(50, input.postsPerDay));
  const [startHourRaw, startMinuteRaw] = input.startTime.split(":");
  const startHour = Number(startHourRaw ?? 9) || 9;
  const startMinute = Number(startMinuteRaw ?? 0) || 0;

  const output: Date[] = [];
  let dayOffset = 0;

  while (output.length < input.count) {
    const remaining = input.count - output.length;
    const countForDay = Math.min(postsPerDay, remaining);
    const dayDate = addDays(now, dayOffset);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = 23 * 60 + 59;
    const availableMinutes = Math.max(1, endMinutes - startMinutes);
    const minutePool = new Set<number>();

    while (minutePool.size < countForDay) {
      const randomMinute = startMinutes + Math.floor(Math.random() * availableMinutes);
      minutePool.add(randomMinute);
    }

    const candidates = Array.from(minutePool)
      .sort((a, b) => a - b)
      .map((minuteOfDay) =>
        zonedDateAtTime(dayDate, input.timezone, Math.floor(minuteOfDay / 60) % 24, minuteOfDay % 60)
      )
      .filter((candidate) => candidate > now || dayOffset > 0);

    for (const candidate of candidates) {
      if (output.length < input.count) {
        output.push(candidate);
      }
    }

    dayOffset += 1;
  }

  return output;
}

export function computeScheduledDates(input: {
  count: number;
  postsPerDay: number;
  timezone: string;
  startTime: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const postsPerDay = Math.max(1, Math.min(50, input.postsPerDay));
  const [startHourRaw, startMinuteRaw] = input.startTime.split(":");
  const startHour = Number(startHourRaw ?? 9) || 9;
  const startMinute = Number(startMinuteRaw ?? 0) || 0;
  const intervalMinutes = Math.max(1, Math.floor((24 * 60) / postsPerDay));

  const output: Date[] = [];
  let dayOffset = 0;
  let slot = 0;

  while (output.length < input.count) {
    const dayDate = addDays(now, dayOffset);
    const slotMinutes = startHour * 60 + startMinute + slot * intervalMinutes;
    const candidate = zonedDateAtTime(
      dayDate,
      input.timezone,
      Math.floor(slotMinutes / 60) % 24,
      slotMinutes % 60
    );

    if (candidate > now || dayOffset > 0) {
      output.push(candidate);
    }

    slot += 1;
    if (slot >= postsPerDay) {
      slot = 0;
      dayOffset += 1;
    }
  }

  return output;
}
