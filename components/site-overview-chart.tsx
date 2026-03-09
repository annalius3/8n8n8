type Point = {
  date: string;
  clicks: number;
  impressions: number;
};

export function SiteOverviewChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Нет данных для графика.</div>;
  }

  const width = 900;
  const height = 280;
  const padding = 28;
  const values = data.flatMap((item) => [item.clicks, item.impressions]);
  const maxValue = Math.max(...values, 1);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const toY = (value: number) => height - padding - (value / maxValue) * (height - padding * 2);
  const clicksPath = data
    .map((item, index) => `${index === 0 ? "M" : "L"} ${padding + index * stepX} ${toY(item.clicks)}`)
    .join(" ");
  const impressionsPath = data
    .map((item, index) => `${index === 0 ? "M" : "L"} ${padding + index * stepX} ${toY(item.impressions)}`)
    .join(" ");

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          Клики
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Показы
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full overflow-visible">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = height - padding - step * (height - padding * 2);
          return <line key={step} x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" opacity="0.12" />;
        })}
        <path d={impressionsPath} fill="none" stroke="rgb(16 185 129)" strokeWidth="3" strokeLinecap="round" />
        <path d={clicksPath} fill="none" stroke="rgb(14 165 233)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-6">
        {data.slice(Math.max(0, data.length - 6)).map((item) => (
          <div key={item.date} className="truncate">
            {item.date.slice(5)}
          </div>
        ))}
      </div>
    </div>
  );
}
