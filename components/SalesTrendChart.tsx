const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

type Point = { date: string; label: string; value: number };

// Static, server-rendered bar chart — no client JS, no charting library.
// Per-bar hover detail comes from the native SVG <title> tooltip.
export default function SalesTrendChart({ data }: { data: Point[] }) {
  const width = 700;
  const height = 220;
  const padLeft = 44;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const niceMax = maxValue * 1.15;
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);
  const avg = data.reduce((s, d) => s + d.value, 0) / (data.length || 1);

  const slotW = chartW / data.length;
  const barW = Math.max(slotW * 0.55, 4);
  const today = new Date().toISOString().slice(0, 10);

  const yFor = (v: number) => padTop + chartH - (v / niceMax) * chartH;
  const xFor = (i: number) => padLeft + i * slotW + (slotW - barW) / 2;

  const hasData = data.some((d) => d.value > 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Daily sales revenue trend">
      {gridlines.map((g, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={yFor(g)} y2={yFor(g)} className="stroke-slate-200" strokeWidth={1} />
          <text x={padLeft - 6} y={yFor(g)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[9px]">
            {g >= 1000 ? `${Math.round(g / 1000)}k` : Math.round(g)}
          </text>
        </g>
      ))}

      {avg > 0 && (
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={yFor(avg)}
          y2={yFor(avg)}
          className="stroke-slate-300"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}

      {hasData ? (
        data.map((d, i) => {
          const isToday = d.date === today;
          const barH = (d.value / niceMax) * chartH;
          const showLabel = data.length <= 10 || i % 2 === 0 || isToday;
          return (
            <g key={d.date}>
              <rect
                x={xFor(i)}
                y={yFor(d.value)}
                width={barW}
                height={Math.max(barH, d.value > 0 ? 2 : 0)}
                rx={3}
                className={isToday ? "fill-blue-500" : "fill-blue-300"}
                opacity={isToday ? 1 : 0.75}
              >
                <title>
                  {d.label}: {peso(d.value)}
                </title>
              </rect>
              {showLabel && (
                <text x={xFor(i) + barW / 2} y={height - padBottom + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })
      ) : (
        <text x={width / 2} y={height / 2} textAnchor="middle" className="fill-slate-400 text-xs">
          No sales recorded in this period.
        </text>
      )}
    </svg>
  );
}
