import Link from "next/link";
import { getRepairRecords, getServiceAgreements, getTechnicians, isBranchHidden, homeServiceBranchId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function DailySalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, repairRecords, agreements, technicians] = await Promise.all([
    getCurrentUser(),
    getRepairRecords(),
    getServiceAgreements(),
    getTechnicians(),
  ]);

  const inRange = (date: string) => (!sp.from || date >= sp.from) && (!sp.to || date <= sp.to);

  const posSales = repairRecords.filter((r) => !r.cancelled && inRange(r.serviceDate) && !isBranchHidden(user, r.branchId));

  const homeServiceSales = agreements.filter(
    (a) =>
      a.phase === "post_repair" &&
      a.requestId &&
      inRange(a.completedAt.slice(0, 10)) &&
      !isBranchHidden(user, homeServiceBranchId(a.technicianId, a.branchId, technicians))
  );

  type DayTotals = { date: string; posCount: number; posRevenue: number; hsCount: number; hsRevenue: number; expenses: number };
  const totals = new Map<string, DayTotals>();
  const ensure = (date: string) => {
    if (!totals.has(date)) totals.set(date, { date, posCount: 0, posRevenue: 0, hsCount: 0, hsRevenue: 0, expenses: 0 });
    return totals.get(date)!;
  };

  for (const r of posSales) {
    const bucket = ensure(r.serviceDate);
    bucket.posCount += 1;
    bucket.posRevenue += r.cost;
    bucket.expenses += r.partsCost + r.laborCost + r.otherExpenses;
  }
  for (const a of homeServiceSales) {
    const bucket = ensure(a.completedAt.slice(0, 10));
    bucket.hsCount += 1;
    bucket.hsRevenue += a.cost;
    bucket.expenses += a.partsCost + a.laborCost + a.otherExpenses;
  }

  const rows = Array.from(totals.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((d) => {
      const netProfit = d.posRevenue + d.hsRevenue - d.expenses;
      return { ...d, netProfit, finalTotalSales: netProfit / 2 };
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      posCount: acc.posCount + r.posCount,
      posRevenue: acc.posRevenue + r.posRevenue,
      hsCount: acc.hsCount + r.hsCount,
      hsRevenue: acc.hsRevenue + r.hsRevenue,
      expenses: acc.expenses + r.expenses,
      netProfit: acc.netProfit + r.netProfit,
    }),
    { posCount: 0, posRevenue: 0, hsCount: 0, hsRevenue: 0, expenses: 0, netProfit: 0 }
  );
  const grandFinalTotalSales = grandTotal.netProfit / 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Daily Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          POS and completed home service revenue broken down by day, across whatever branch(es) this account can access.
        </p>
      </div>

      <SalesTabs />

      <form className="card flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="input w-44" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="input w-44" />
        </div>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/sales/daily" className="btn-secondary">
          Clear
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">POS Jobs</th>
              <th className="pb-2 pr-3 font-medium">POS Revenue</th>
              <th className="pb-2 pr-3 font-medium">Home Service Jobs</th>
              <th className="pb-2 pr-3 font-medium">Home Service Revenue</th>
              <th className="pb-2 pr-3 font-medium">Total Income</th>
              <th className="pb-2 pr-3 font-medium">Expenses</th>
              <th className="pb-2 pr-3 font-medium">Net Profit</th>
              <th className="pb-2 font-medium">Final Total Sales (50%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">
                  No sales recorded yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{r.date}</td>
                <td className="py-3 pr-3 text-slate-500">{r.posCount}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.posRevenue)}</td>
                <td className="py-3 pr-3 text-slate-500">{r.hsCount}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.hsRevenue)}</td>
                <td className="py-3 pr-3 font-semibold text-slate-900">{peso(r.posRevenue + r.hsRevenue)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.expenses)}</td>
                <td className="py-3 pr-3 font-semibold text-green-700">{peso(r.netProfit)}</td>
                <td className="py-3 font-semibold text-blue-300">{peso(r.finalTotalSales)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3">Total</td>
                <td className="pt-3 pr-3">{grandTotal.posCount}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.posRevenue)}</td>
                <td className="pt-3 pr-3">{grandTotal.hsCount}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.hsRevenue)}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.posRevenue + grandTotal.hsRevenue)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.expenses)}</td>
                <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.netProfit)}</td>
                <td className="pt-3 text-blue-300">{peso(grandFinalTotalSales)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
