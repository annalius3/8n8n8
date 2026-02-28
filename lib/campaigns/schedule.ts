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
