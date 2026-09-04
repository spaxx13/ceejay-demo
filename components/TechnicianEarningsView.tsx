import Link from "next/link";
import type { EarningsJob, EarningsPeriod } from "@/lib/earnings";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIOD_LABELS: Record<EarningsPeriod, string> = { day: "Today", week: "This Week", month: "This Month" };

export default function TechnicianEarningsView({
  baseHref,
  technicianName,
  jobs,
  period,
  from,
  to,
  isCustomRange,
}: {
  baseHref: string;
  technicianName: string;
  jobs: EarningsJob[];
  period: EarningsPeriod;
  from: string;
  to: string;
  isCustomRange: boolean;
}) {
  const total = jobs.reduce((s, j) => s + j.serviceFee, 0);

  return (
    <div className="space-y-4">
      <div className="card !p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {(["day", "week", "month"] as EarningsPeriod[]).map((p) => (
              <Link
                key={p}
                href={`${baseHref}?period=${p}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !isCustomRange && period === p ? "bg-blue-100 text-blue-500" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="period" value={period} />
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-500">From</label>
              <input type="date" name="from" defaultValue={from} className="input !py-1 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-500">To</label>
              <input type="date" name="to" defaultValue={to} className="input !py-1 text-xs" />
            </div>
            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
              Filter
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-slate-400">
          {technicianName} — {isCustomRange ? `${from} to ${to}` : PERIOD_LABELS[period]}
        </p>
        <p className="mt-1 text-2xl font-bold text-green-700">{peso(total)}</p>
        <p className="text-xs text-slate-400">{jobs.length} completed job{jobs.length === 1 ? "" : "s"}</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Source</th>
              <th className="pb-2 pr-3 font-medium">Reference</th>
              <th className="pb-2 pr-3 font-medium">Customer</th>
              <th className="pb-2 pr-3 font-medium">Device</th>
              <th className="pb-2 font-medium">Service Fee</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No completed jobs in this period.
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 text-slate-500">{j.date}</td>
                <td className="py-2.5 pr-3 text-slate-500">{j.source}</td>
                <td className="py-2.5 pr-3 font-mono text-xs text-blue-300">{j.reference}</td>
                <td className="py-2.5 pr-3 text-slate-800">{j.customerName}</td>
                <td className="py-2.5 pr-3 text-slate-500">{j.deviceLabel}</td>
                <td className="py-2.5 font-semibold text-slate-800">{peso(j.serviceFee)}</td>
              </tr>
            ))}
            {jobs.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td colSpan={5} className="pt-3 pr-3 text-right">
                  Total
                </td>
                <td className="pt-3 text-green-700">{peso(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
