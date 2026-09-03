import Link from "next/link";
import { getBranches, getRepairRecords, getRequests, getServiceAgreements, getExpenses, isBranchHidden, canViewAllBranchSales } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BranchSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, allBranches, repairRecords, requests, agreements, expenses] = await Promise.all([
    getCurrentUser(),
    getBranches(),
    getRepairRecords(),
    getRequests(),
    getServiceAgreements(),
    getExpenses(),
  ]);
  const branches = allBranches.filter((b) => !isBranchHidden(user, b.id));

  // Default to today so the page always opens on the most current sales —
  // an explicit From/To filter (even a partial one) overrides this.
  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // POS sales: completed/pending repair_records with a declared cost, minus cancelled.
  const posSales = repairRecords.filter((r) => !r.cancelled && inRange(r.serviceDate) && !isBranchHidden(user, r.branchId));

  // Home service sales: a job only has revenue once its Post-Repair checklist
  // is completed — that's the same agreement that carries the price the
  // technician entered. Branch comes from the request (set when a
  // technician is assigned to it).
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const homeServiceSales = agreements.filter(
    (a) => a.phase === "post_repair" && a.requestId && inRange(a.completedAt.slice(0, 10)) && !isBranchHidden(user, requestById.get(a.requestId)?.branchId ?? null)
  );

  type BranchTotals = { name: string; branchId: string | null; posCount: number; posRevenue: number; hsCount: number; hsRevenue: number; expenses: number };
  const totals = new Map<string, BranchTotals>();
  const key = (branchId: string | null) => branchId ?? "unassigned";
  const ensure = (branchId: string | null, name: string) => {
    const k = key(branchId);
    if (!totals.has(k)) totals.set(k, { name, branchId, posCount: 0, posRevenue: 0, hsCount: 0, hsRevenue: 0, expenses: 0 });
    return totals.get(k)!;
  };

  // Which technicians handled a transaction at each branch, and how much
  // they brought in — shown as a sub-table on each branch's card.
  type TechBucket = { name: string; count: number; revenue: number };
  const techByBranch = new Map<string, Map<string, TechBucket>>();
  const ensureTech = (branchId: string | null, rawName: string) => {
    const bk = key(branchId);
    const name = rawName.trim() || "Unassigned";
    if (!techByBranch.has(bk)) techByBranch.set(bk, new Map());
    const branchMap = techByBranch.get(bk)!;
    if (!branchMap.has(name)) branchMap.set(name, { name, count: 0, revenue: 0 });
    return branchMap.get(name)!;
  };

  for (const b of branches) ensure(b.id, b.name);

  for (const r of posSales) {
    const branch = branches.find((b) => b.id === r.branchId);
    const bucket = ensure(r.branchId, branch?.name ?? "Unassigned");
    bucket.posCount += 1;
    bucket.posRevenue += r.cost;
    bucket.expenses += r.partsCost + r.laborCost + r.otherExpenses;
    const techBucket = ensureTech(r.branchId, r.technicianName);
    techBucket.count += 1;
    techBucket.revenue += r.cost;
  }
  for (const a of homeServiceSales) {
    const req = requestById.get(a.requestId!);
    const branch = branches.find((b) => b.id === req?.branchId);
    const bucket = ensure(req?.branchId ?? null, branch?.name ?? "Unassigned");
    bucket.hsCount += 1;
    bucket.hsRevenue += a.cost;
    bucket.expenses += a.partsCost + a.laborCost + a.otherExpenses;
    const techBucket = ensureTech(req?.branchId ?? null, a.technicianName);
    techBucket.count += 1;
    techBucket.revenue += a.cost;
  }

  const rows = Array.from(totals.values())
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return a.name.localeCompare(b.name);
    })
    .map((r) => {
      const netProfit = r.posRevenue + r.hsRevenue - r.expenses;
      return { ...r, netProfit, finalTotalSales: netProfit / 2 };
    });

  const grandTotal = {
    posCount: rows.reduce((s, r) => s + r.posCount, 0),
    posRevenue: rows.reduce((s, r) => s + r.posRevenue, 0),
    hsCount: rows.reduce((s, r) => s + r.hsCount, 0),
    hsRevenue: rows.reduce((s, r) => s + r.hsRevenue, 0),
    expenses: rows.reduce((s, r) => s + r.expenses, 0),
    netProfit: rows.reduce((s, r) => s + r.netProfit, 0),
  };
  const grandFinalTotalSales = grandTotal.netProfit / 2;

  const inRangeExpenses = expenses.filter((e) => inRange(e.expenseDate));
  const ownerFinalDeductions = inRangeExpenses.filter((e) => e.target === "owner_final_total_sales").reduce((s, e) => s + e.amount, 0);
  const ownerTotalSalesDeductions = inRangeExpenses.filter((e) => e.target === "owner_total_sales").reduce((s, e) => s + e.amount, 0);
  const combinedRevenue = grandTotal.posRevenue + grandTotal.hsRevenue;
  const ownerTotalSalesNet = combinedRevenue - ownerTotalSalesDeductions;
  const ownerFinalTotalSalesNet = grandFinalTotalSales - ownerFinalDeductions;
  const showAllBranches = canViewAllBranchSales(user);

  // An owner-level expense can optionally be tied to one specific branch
  // (only deducted from that branch's card); left unassigned, it applies to
  // every branch's card. Either way it always counts toward the true
  // combined Owner Deductions total above.
  const deductionsFor = (target: "owner_final_total_sales" | "owner_total_sales", branchId: string | null) =>
    inRangeExpenses.filter((e) => e.target === target && (e.branchId === null || e.branchId === branchId)).reduce((s, e) => s + e.amount, 0);

  const rowsWithDeductions = rows.map((r) => {
    const branchTotalSalesDeductions = deductionsFor("owner_total_sales", r.branchId);
    const branchFinalDeductions = deductionsFor("owner_final_total_sales", r.branchId);
    const technicians = Array.from(techByBranch.get(key(r.branchId))?.values() ?? []).sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.revenue - a.revenue;
    });
    return {
      ...r,
      branchTotalSalesDeductions,
      branchFinalDeductions,
      totalIncomeNet: r.posRevenue + r.hsRevenue - branchTotalSalesDeductions,
      finalTotalSalesNet: r.finalTotalSales - branchFinalDeductions,
      technicians,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Branch Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Revenue by branch, combining walk-in/POS repair records and completed home service jobs, with parts cost deducted to show net
          profit.
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
        <Link href="/admin/sales" className="btn-secondary">
          Reset to Today
        </Link>
      </form>
      {!hasFilter && <p className="-mt-3 text-xs text-slate-400">Showing today&apos;s sales ({today}). Set a date range above to see other days.</p>}

      {showAllBranches && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="card">
          <p className="text-xs text-slate-400">POS Revenue</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(grandTotal.posRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Home Service Revenue</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(grandTotal.hsRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Combined Revenue</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(grandTotal.posRevenue + grandTotal.hsRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-bold text-red-700">−{peso(grandTotal.expenses)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Net Profit</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{peso(grandTotal.netProfit)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Final Total Sales (50%)</p>
          <p className="mt-1 text-2xl font-bold text-blue-300">{peso(grandFinalTotalSales)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Total Transactions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{grandTotal.posCount + grandTotal.hsCount}</p>
        </div>
      </div>
      )}

      <div className="space-y-4">
        {rowsWithDeductions.map((r) => {
          const branchEntry = branches.find((b) => b.name === r.name);
          return (
            <div key={r.name} className={`card space-y-3 ${r.name === "Unassigned" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{r.name}</h3>
                <p className="text-base font-bold text-green-700">{peso(r.netProfit)}</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Source</th>
                    <th className="pb-2 pr-3 font-medium">Transactions</th>
                    <th className="pb-2 pr-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">POS Sales</td>
                    <td className="py-2 pr-3 text-slate-500">{r.posCount}</td>
                    <td className="py-2 pr-3 text-slate-800">{peso(r.posRevenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">Home Service Sales</td>
                    <td className="py-2 pr-3 text-slate-500">{r.hsCount}</td>
                    <td className="py-2 pr-3 text-slate-800">{peso(r.hsRevenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="pt-2 pr-3 font-semibold text-slate-800">Total Income</td>
                    <td className="pt-2 pr-3 font-semibold text-slate-800">{r.posCount + r.hsCount}</td>
                    <td className="pt-2 pr-3 font-semibold text-slate-900">{peso(r.posRevenue + r.hsRevenue)}</td>
                  </tr>
                  {r.branchTotalSalesDeductions > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">Business Expenses (Owner)</td>
                        <td className="py-2 pr-3 text-slate-500">—</td>
                        <td className="py-2 pr-3 text-red-700">−{peso(r.branchTotalSalesDeductions)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="pt-2 pr-3 font-semibold text-slate-800">Total Income (Net)</td>
                        <td className="pt-2 pr-3 text-slate-500">—</td>
                        <td className="pt-2 pr-3 font-semibold text-blue-300">{peso(r.totalIncomeNet)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">Expenses</td>
                    <td className="py-2 pr-3 text-slate-500">—</td>
                    <td className="py-2 pr-3 text-red-700">−{peso(r.expenses)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="pt-2 pr-3 font-semibold text-slate-800">Net Profit</td>
                    <td className="pt-2 pr-3 text-slate-500">—</td>
                    <td className="pt-2 pr-3 font-semibold text-green-700">{peso(r.netProfit)}</td>
                  </tr>
                  <tr className={r.branchFinalDeductions > 0 ? "border-b border-slate-100" : ""}>
                    <td className="pt-2 pr-3 font-semibold text-slate-800">Final Total Sales (50%)</td>
                    <td className="pt-2 pr-3 text-slate-500">—</td>
                    <td className="pt-2 pr-3 font-semibold text-blue-300">{peso(r.finalTotalSales)}</td>
                  </tr>
                  {r.branchFinalDeductions > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">Business Expenses (Owner)</td>
                        <td className="py-2 pr-3 text-slate-500">—</td>
                        <td className="py-2 pr-3 text-red-700">−{peso(r.branchFinalDeductions)}</td>
                      </tr>
                      <tr>
                        <td className="pt-2 pr-3 font-semibold text-slate-800">Final Total Sales (Net)</td>
                        <td className="pt-2 pr-3 text-slate-500">—</td>
                        <td className="pt-2 pr-3 font-semibold text-blue-300">{peso(r.finalTotalSalesNet)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              {r.technicians.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Technicians</p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 pr-3 font-medium">Technician</th>
                        <th className="pb-2 pr-3 font-medium">Jobs</th>
                        <th className="pb-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.technicians.map((t) => (
                        <tr key={t.name} className={`border-b border-slate-100 last:border-0 ${t.name === "Unassigned" ? "opacity-60" : ""}`}>
                          <td className="py-2 pr-3 text-slate-700">{t.name}</td>
                          <td className="py-2 pr-3 text-slate-500">{t.count}</td>
                          <td className="py-2 text-slate-800">{peso(t.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {branchEntry && (
                <Link href={`/admin/pos?branch=${branchEntry.id}`} className="btn-secondary inline-block !px-3 !py-1 text-xs">
                  View POS Records
                </Link>
              )}
            </div>
          );
        })}

        {showAllBranches && (
        <div className="card space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Total Income (All Branches)</h3>
            <p className="text-base font-bold text-slate-900">{peso(grandTotal.posRevenue + grandTotal.hsRevenue)}</p>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Expenses (parts, labor, other)</span>
            <span className="text-red-700">−{peso(grandTotal.expenses)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <h3 className="text-sm font-semibold text-slate-800">Net Profit (All Branches)</h3>
            <p className="text-base font-bold text-green-700">{peso(grandTotal.netProfit)}</p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <h3 className="text-sm font-semibold text-slate-800">Final Total Sales (All Branches, 50%)</h3>
            <p className="text-base font-bold text-blue-300">{peso(grandFinalTotalSales)}</p>
          </div>
        </div>
        )}

        {showAllBranches && (
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-800">Owner Deductions</h3>
          <p className="text-xs text-slate-400">Business expenses logged under Sales &gt; Expenses, deducted from the owner&apos;s totals.</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-slate-600">Total Sales of the Owner</span>
            <span className="text-sm text-slate-800">{peso(combinedRevenue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Business Expenses</span>
            <span className="text-red-700">−{peso(ownerTotalSalesDeductions)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <h3 className="text-sm font-semibold text-slate-800">Total Sales of the Owner (Net)</h3>
            <p className="text-base font-bold text-blue-300">{peso(ownerTotalSalesNet)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-slate-600">Owner&apos;s Final Total Sales (50%)</span>
            <span className="text-sm text-slate-800">{peso(grandFinalTotalSales)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Business Expenses</span>
            <span className="text-red-700">−{peso(ownerFinalDeductions)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <h3 className="text-sm font-semibold text-slate-800">Owner&apos;s Final Total Sales (Net)</h3>
            <p className="text-base font-bold text-blue-300">{peso(ownerFinalTotalSalesNet)}</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
