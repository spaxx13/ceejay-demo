import Link from "next/link";
import { getRepairRecords, getServiceAgreements, getExpenses, getTechnicians, isBranchHidden, homeServiceBranchId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default async function TechnicianSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, repairRecords, agreements, expenses, technicians] = await Promise.all([
    getCurrentUser(),
    getRepairRecords(),
    getServiceAgreements(),
    getExpenses(),
    getTechnicians(),
  ]);

  // Default to today so the page always opens on the most current sales —
  // an explicit From/To filter (even a partial one) overrides this.
  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // Same two sources as Branch Sales — POS repair records and completed
  // home-service Post-Repair checklists — but grouped by the technician's
  // name (as typed/recorded on each job) instead of branch.
  const posSales = repairRecords.filter((r) => !r.cancelled && inRange(r.serviceDate) && !isBranchHidden(user, r.branchId));
  const homeServiceSales = agreements.filter(
    (a) =>
      a.phase === "post_repair" &&
      a.requestId &&
      inRange(a.completedAt.slice(0, 10)) &&
      !isBranchHidden(user, homeServiceBranchId(a.technicianId, a.branchId, technicians))
  );
  const technicianExpenses = expenses.filter(
    (e) => e.target === "technician_final_total_sales" && inRange(e.expenseDate) && !isBranchHidden(user, e.branchId)
  );

  type TechTotals = { name: string; count: number; totalSales: number; partsCost: number; laborCost: number; otherExpenses: number };
  const totals = new Map<string, TechTotals>();
  const ensure = (rawName: string) => {
    const name = rawName.trim() || "Unassigned";
    if (!totals.has(name)) totals.set(name, { name, count: 0, totalSales: 0, partsCost: 0, laborCost: 0, otherExpenses: 0 });
    return totals.get(name)!;
  };

  for (const r of posSales) {
    const bucket = ensure(r.technicianName);
    bucket.count += 1;
    bucket.totalSales += r.cost;
    bucket.partsCost += r.partsCost;
    bucket.laborCost += r.laborCost;
    bucket.otherExpenses += r.otherExpenses;
  }
  for (const a of homeServiceSales) {
    const bucket = ensure(a.technicianName);
    bucket.count += 1;
    bucket.totalSales += a.cost;
    bucket.partsCost += a.partsCost;
    bucket.laborCost += a.laborCost;
    bucket.otherExpenses += a.otherExpenses;
  }

  const rows = Array.from(totals.values())
    .map((t) => {
      const totalExpenses = t.partsCost + t.laborCost + t.otherExpenses;
      const netProfit = t.totalSales - totalExpenses;
      const profitMargin = t.totalSales > 0 ? (netProfit / t.totalSales) * 100 : 0;
      const finalTotalSales = netProfit / 2;
      const businessExpenses = technicianExpenses.filter((e) => e.technicianName === t.name).reduce((s, e) => s + e.amount, 0);
      return { ...t, totalExpenses, netProfit, profitMargin, finalTotalSales, businessExpenses, finalTotalSalesNet: finalTotalSales - businessExpenses };
    })
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.totalSales - a.totalSales;
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      totalSales: acc.totalSales + r.totalSales,
      partsCost: acc.partsCost + r.partsCost,
      laborCost: acc.laborCost + r.laborCost,
      otherExpenses: acc.otherExpenses + r.otherExpenses,
      totalExpenses: acc.totalExpenses + r.totalExpenses,
      netProfit: acc.netProfit + r.netProfit,
    }),
    { count: 0, totalSales: 0, partsCost: 0, laborCost: 0, otherExpenses: 0, totalExpenses: 0, netProfit: 0 }
  );
  const grandMargin = grandTotal.totalSales > 0 ? (grandTotal.netProfit / grandTotal.totalSales) * 100 : 0;
  const grandFinalTotalSales = grandTotal.netProfit / 2;
  const grandBusinessExpenses = technicianExpenses.reduce((s, e) => s + e.amount, 0);
  const grandFinalTotalSalesNet = grandFinalTotalSales - grandBusinessExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Sales and Net Profit by Technician</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each technician&apos;s total sales, expenses, and net profit across POS repair records and completed home service jobs.
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
        <Link href="/admin/sales/technicians" className="btn-secondary">
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
              <th className="pb-2 pr-3 font-medium">Total Sales</th>
              <th className="pb-2 pr-3 font-medium">Parts/Material Cost</th>
              <th className="pb-2 pr-3 font-medium">Labor/Service Cost</th>
              <th className="pb-2 pr-3 font-medium">Other Expenses</th>
              <th className="pb-2 pr-3 font-medium">Total Expenses</th>
              <th className="pb-2 pr-3 font-medium">Net Profit</th>
              <th className="pb-2 pr-3 font-medium">Profit Margin</th>
              <th className="pb-2 pr-3 font-medium">Final Total Sales (50%)</th>
              <th className="pb-2 pr-3 font-medium">Business Expenses</th>
              <th className="pb-2 font-medium">Final Total Sales (Net)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-slate-400">
                  No sales recorded yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.name} className={`border-b border-slate-200 last:border-0 ${r.name === "Unassigned" ? "opacity-60" : ""}`}>
                <td className="py-3 pr-3 font-medium text-slate-800">{r.name}</td>
                <td className="py-3 pr-3 text-slate-500">{r.count}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.totalSales)}</td>
                <td className="py-3 pr-3 text-slate-500">{peso(r.partsCost)}</td>
                <td className="py-3 pr-3 text-slate-500">{peso(r.laborCost)}</td>
                <td className="py-3 pr-3 text-slate-500">{peso(r.otherExpenses)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.totalExpenses)}</td>
                <td className="py-3 pr-3 font-semibold text-green-700">{peso(r.netProfit)}</td>
                <td className="py-3 pr-3 font-semibold text-slate-800">{pct(r.profitMargin)}</td>
                <td className="py-3 pr-3 font-semibold text-blue-300">{peso(r.finalTotalSales)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.businessExpenses)}</td>
                <td className="py-3 font-semibold text-blue-300">{peso(r.finalTotalSalesNet)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3">Total</td>
                <td className="pt-3 pr-3">{grandTotal.count}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.totalSales)}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.partsCost)}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.laborCost)}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.otherExpenses)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.totalExpenses)}</td>
                <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.netProfit)}</td>
                <td className="pt-3 pr-3">{pct(grandMargin)}</td>
                <td className="pt-3 pr-3 text-blue-300">{peso(grandFinalTotalSales)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandBusinessExpenses)}</td>
                <td className="pt-3 text-blue-300">{peso(grandFinalTotalSalesNet)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
