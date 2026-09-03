import Link from "next/link";
import { getServiceAgreements } from "@/lib/db";
import SalesTabs from "@/components/SalesTabs";
import { formatDate } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function MaterialCostLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const agreements = await getServiceAgreements();

  // Default to today so the page always opens on the most current sales —
  // an explicit From/To filter (even a partial one) overrides this.
  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // A dedicated, itemized log of every Parts/Material Cost entry recorded
  // on a completed home service job — internal-only, never shown to the
  // customer, but kept visible here so it's easy to review even though it
  // no longer appears on the customer-facing checklist summary or receipt.
  const entries = agreements
    .filter((a) => a.phase === "post_repair" && a.requestId && a.partsCost > 0 && inRange(a.completedAt.slice(0, 10)))
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));

  const total = entries.reduce((s, a) => s + a.partsCost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Parts/Material Cost Log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every Parts/Material Cost entry recorded on a completed home service job — internal-only records, kept here for review even though
          they&apos;re not shown to the customer.
        </p>
      </div>

      <SalesTabs />

      <form className="card flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" name="from" defaultValue={from ?? ""} className="input w-44" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" name="to" defaultValue={to ?? ""} className="input w-44" />
        </div>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/sales/materials" className="btn-secondary">
          Reset to Today
        </Link>
      </form>
      {!hasFilter && <p className="-mt-3 text-xs text-slate-400">Showing today&apos;s entries ({today}). Set a date range above to see other days.</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Reference</th>
              <th className="pb-2 pr-3 font-medium">Customer</th>
              <th className="pb-2 pr-3 font-medium">Technician</th>
              <th className="pb-2 font-medium">Parts/Material Cost</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No Parts/Material Cost entries recorded for this range.
                </td>
              </tr>
            )}
            {entries.map((a) => (
              <tr key={a.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 text-slate-500">{formatDate(a.completedAt.slice(0, 10))}</td>
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{a.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{a.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{a.technicianName || "—"}</td>
                <td className="py-3 text-red-700">−{peso(a.partsCost)}</td>
              </tr>
            ))}
            {entries.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3" colSpan={4}>
                  Total
                </td>
                <td className="pt-3 text-red-700">−{peso(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
