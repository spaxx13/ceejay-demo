import Link from "next/link";
import { getServiceAgreements } from "@/lib/db";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COMPANY_SHARE = 0.3;
const TECHNICIAN_SHARE = 0.7;

export default async function HomeServiceSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const agreements = await getServiceAgreements();

  // Default to today so the page always opens on the most current sales —
  // an explicit From/To filter (even a partial one) overrides this.
  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // Home service jobs only — a job only has revenue once its Post-Repair
  // checklist is completed. Repair Price + Labor/Service Cost together are
  // the Total Amount charged to the customer (the same figure shown to the
  // customer on the checklist/receipt — Parts/Material Cost never appears
  // there). For the 30/70 split, Parts/Material Cost is deducted from that
  // Total Amount to get a Net Amount — an internal-records-only figure,
  // never shown to the customer. Distinct from the Net Profit / 50% split
  // used on the combined By Branch and By Technician reports. Not
  // branch-scoped: this report is organized by technician, and a job's
  // branch tag is incidental (whichever branch the technician was
  // dispatched from), not a meaningful visibility boundary — every account
  // that can open Sales sees all of it.
  const homeServiceJobs = agreements.filter((a) => a.phase === "post_repair" && a.requestId && inRange(a.completedAt.slice(0, 10)));

  type TechTotals = { name: string; count: number; totalAmount: number; partsCost: number };
  const totals = new Map<string, TechTotals>();
  const ensure = (rawName: string) => {
    const name = rawName.trim() || "Unassigned";
    if (!totals.has(name)) totals.set(name, { name, count: 0, totalAmount: 0, partsCost: 0 });
    return totals.get(name)!;
  };

  for (const a of homeServiceJobs) {
    const bucket = ensure(a.technicianName);
    bucket.count += 1;
    bucket.totalAmount += a.cost + a.laborCost;
    bucket.partsCost += a.partsCost;
  }

  const rows = Array.from(totals.values())
    .map((t) => {
      const netAmount = Math.max(0, t.totalAmount - t.partsCost);
      return { ...t, netAmount, companyShare: netAmount * COMPANY_SHARE, technicianShare: netAmount * TECHNICIAN_SHARE };
    })
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.totalAmount - a.totalAmount;
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      totalAmount: acc.totalAmount + r.totalAmount,
      partsCost: acc.partsCost + r.partsCost,
      netAmount: acc.netAmount + r.netAmount,
      companyShare: acc.companyShare + r.companyShare,
      technicianShare: acc.technicianShare + r.technicianShare,
    }),
    { count: 0, totalAmount: 0, partsCost: 0, netAmount: 0, companyShare: 0, technicianShare: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Home Service Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each technician&apos;s home service earnings — Total Amount is Repair Price + Labor/Service Cost (what the customer is charged).
          Parts/Material Cost is deducted internally to get the Net Amount, split 30% to the business and 70% to the technician.
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
        <Link href="/admin/sales/home-service" className="btn-secondary">
          Reset to Today
        </Link>
      </form>
      {!hasFilter && <p className="-mt-3 text-xs text-slate-400">Showing today&apos;s sales ({today}). Set a date range above to see other days.</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Technician</th>
              <th className="pb-2 pr-3 font-medium">Jobs</th>
              <th className="pb-2 pr-3 font-medium">Total Amount</th>
              <th className="pb-2 pr-3 font-medium">Parts/Material Cost</th>
              <th className="pb-2 pr-3 font-medium">Net Amount</th>
              <th className="pb-2 pr-3 font-medium">Company Share (30%)</th>
              <th className="pb-2 font-medium">Technician Share (70%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No home service sales recorded for this range.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.name} className={`border-b border-slate-200 last:border-0 ${r.name === "Unassigned" ? "opacity-60" : ""}`}>
                <td className="py-3 pr-3 font-medium text-slate-800">{r.name}</td>
                <td className="py-3 pr-3 text-slate-500">{r.count}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.totalAmount)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.partsCost)}</td>
                <td className="py-3 pr-3 font-semibold text-slate-900">{peso(r.netAmount)}</td>
                <td className="py-3 pr-3 text-green-700">{peso(r.companyShare)}</td>
                <td className="py-3 font-semibold text-blue-300">{peso(r.technicianShare)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3">Total</td>
                <td className="pt-3 pr-3">{grandTotal.count}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.totalAmount)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.partsCost)}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.netAmount)}</td>
                <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.companyShare)}</td>
                <td className="pt-3 text-blue-300">{peso(grandTotal.technicianShare)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
