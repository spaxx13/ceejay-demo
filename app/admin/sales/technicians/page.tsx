import Link from "next/link";
import { getRepairRecords, getServiceAgreements, getExpenses, getTechnicians, isBranchHidden, homeServiceBranchId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toJob, DEFAULT_EARNINGS_SHARE_PERCENT } from "@/lib/earnings";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const techByName = new Map(technicians.map((t) => [t.name, t]));
  const shareFor = (name: string) => techByName.get(name)?.earningsSharePercent ?? DEFAULT_EARNINGS_SHARE_PERCENT;

  // Same two sources as My Earnings — POS repair records and completed
  // home-service Post-Repair checklists — but grouped by the technician's
  // name (as typed/recorded on each job) instead of per-technician detail.
  // Uses the exact same Gross/Net/Earnings math (lib/earnings.ts's toJob) so
  // this summary always agrees with each technician's own Earnings page.
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

  type TechTotals = { name: string; count: number; repairCost: number; serviceFee: number; partsCost: number; gross: number; net: number; earnings: number };
  const totals = new Map<string, TechTotals>();
  const ensure = (rawName: string) => {
    const name = rawName.trim() || "Unassigned";
    if (!totals.has(name)) totals.set(name, { name, count: 0, repairCost: 0, serviceFee: 0, partsCost: 0, gross: 0, net: 0, earnings: 0 });
    return totals.get(name)!;
  };
  const add = (rawName: string, repairCost: number, serviceFee: number, partsCost: number) => {
    const bucket = ensure(rawName);
    const job = toJob("", "POS", "", "", "", "", repairCost, serviceFee, partsCost, shareFor(rawName.trim() || "Unassigned"));
    bucket.count += 1;
    bucket.repairCost += repairCost;
    bucket.serviceFee += serviceFee;
    bucket.partsCost += partsCost;
    bucket.gross += job.gross;
    bucket.net += job.net;
    bucket.earnings += job.earnings;
  };

  for (const r of posSales) add(r.technicianName, r.cost, r.laborCost, r.partsCost);
  for (const a of homeServiceSales) add(a.technicianName, a.cost, a.laborCost, a.partsCost);

  const rows = Array.from(totals.values())
    .map((t) => {
      const businessExpenses = technicianExpenses.filter((e) => e.technicianName === t.name).reduce((s, e) => s + e.amount, 0);
      return { ...t, businessExpenses, finalEarningsNet: t.earnings - businessExpenses };
    })
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.gross - a.gross;
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      repairCost: acc.repairCost + r.repairCost,
      serviceFee: acc.serviceFee + r.serviceFee,
      partsCost: acc.partsCost + r.partsCost,
      gross: acc.gross + r.gross,
      net: acc.net + r.net,
      earnings: acc.earnings + r.earnings,
      businessExpenses: acc.businessExpenses + r.businessExpenses,
      finalEarningsNet: acc.finalEarningsNet + r.finalEarningsNet,
    }),
    { count: 0, repairCost: 0, serviceFee: 0, partsCost: 0, gross: 0, net: 0, earnings: 0, businessExpenses: 0, finalEarningsNet: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Technician Earnings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each technician&apos;s share of completed jobs (POS and home service), computed the same way as their own My Earnings page.
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
              <th className="pb-2 pr-3 font-medium">% Earnings</th>
              <th className="pb-2 pr-3 font-medium">Jobs</th>
              <th className="pb-2 pr-3 font-medium">Repair Cost</th>
              <th className="pb-2 pr-3 font-medium">Service Fee</th>
              <th className="pb-2 pr-3 font-medium">Parts Cost</th>
              <th className="pb-2 pr-3 font-medium">Gross</th>
              <th className="pb-2 pr-3 font-medium">Net</th>
              <th className="pb-2 pr-3 font-medium">Earnings</th>
              <th className="pb-2 pr-3 font-medium">Business Expenses</th>
              <th className="pb-2 pr-3 font-medium">Final Earnings (Net)</th>
              <th className="pb-2 font-medium"></th>
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
                <td className="py-3 pr-3 text-slate-500">
                  {techByName.get(r.name) ? `${techByName.get(r.name)!.earningsSharePercent}%` : "—"}
                </td>
                <td className="py-3 pr-3 text-slate-500">{r.count}</td>
                <td className="py-3 pr-3 text-slate-500">{peso(r.repairCost)}</td>
                <td className="py-3 pr-3 text-slate-500">{peso(r.serviceFee)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.partsCost)}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.gross)}</td>
                <td className="py-3 pr-3 font-semibold text-slate-900">{peso(r.net)}</td>
                <td className="py-3 pr-3 font-semibold text-green-700">{peso(r.earnings)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.businessExpenses)}</td>
                <td className="py-3 pr-3 font-semibold text-blue-300">{peso(r.finalEarningsNet)}</td>
                <td className="py-3">
                  {techByName.get(r.name) && (
                    <Link href={`/admin/sales/technicians/${techByName.get(r.name)!.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                      Details
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3">Total</td>
                <td className="pt-3 pr-3"></td>
                <td className="pt-3 pr-3">{grandTotal.count}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.repairCost)}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.serviceFee)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.partsCost)}</td>
                <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.gross)}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.net)}</td>
                <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.earnings)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.businessExpenses)}</td>
                <td className="pt-3 pr-3 text-blue-300">{peso(grandTotal.finalEarningsNet)}</td>
                <td className="pt-3"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
