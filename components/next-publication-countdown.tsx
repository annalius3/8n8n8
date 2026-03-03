"use client";

import { useEffect, useMemo, useState } from "react";

function formatDistance(targetIso: string) {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) {
    return "Сейчас или просрочено";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  parts.push(`${minutes} мин`);

  return parts.join(" ");
}

export function NextPublicationCountdown({
  scheduledAt,
  emptyLabel = "Не запланировано"
}: {
  scheduledAt: string | null;
  emptyLabel?: string;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!scheduledAt) return;

    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [scheduledAt]);

  const label = useMemo(() => {
    if (!scheduledAt) return emptyLabel;
    return formatDistance(scheduledAt);
  }, [scheduledAt, emptyLabel]);

  return <span>{label}</span>;
}
