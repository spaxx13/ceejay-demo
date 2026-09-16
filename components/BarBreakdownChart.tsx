const BAR_COLORS = ["bg-blue-300", "bg-emerald-300", "bg-amber-300", "bg-violet-300", "bg-rose-300", "bg-cyan-300", "bg-lime-300"];

export default function BarBreakdownChart({
  data,
  formatValue = (v: number) => v.toLocaleString(),
  emptyMessage = "No data yet.",
}: {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (total === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-slate-700">{d.label}</span>
            <span className="shrink-0 text-slate-400">
              {formatValue(d.value)} ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div className={`h-2.5 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
