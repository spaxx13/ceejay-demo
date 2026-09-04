import Link from "next/link";
import { getBranches, getRepairRecords, getExpenses, isBranchHidden, canViewAllBranchSales } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The one technician exempt from the 50/50 split — his full net profit on
// every job counts entirely toward the business's Remaining share, never
// split with anyone. Matched by exact technician name.
const EXEMPT_TECHNICIAN_NAME = "Boss Ceejay";
const TECHNICIAN_SHARE_RATE = 0.5;

export default async function BranchSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, allBranches, repairRecords, expenses] = await Promise.all([
    getCurrentUser(),
    getBranches(),
    getRepairRecords(),
    getExpenses(),
  ]);
  // Backend-only branches (no address, e.g. "Home Service") exist purely for
  // sales/expense attribution — they don't get their own card here since
  // that data has its own dedicated Sales > Home Service tab instead.
  const branches = allBranches.filter((b) => !isBranchHidden(user, b.id) && b.address);

  // Default to today so the page always opens on the most current sales —
  // an explicit From/To filter (even a partial one) overrides this.
  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // This page is walk-in/POS repair records only — completed home service
  // jobs are tracked entirely on the dedicated Sales > Home Service tab, so
  // that revenue is never mixed into these branch totals.
  const posSales = repairRecords.filter((r) => !r.cancelled && inRange(r.serviceDate) && !isBranchHidden(user, r.branchId));

  // Every figure on this page is built the same way, bottom-up:
  //   1. Each technician's own Net Profit = their revenue minus their own
  //      job costs (parts/labor/other) — untouched by anything else.
  //   2. That Net Profit splits into a Technician Share and a Remaining
  //      (Business) share. Boss Ceejay is the one exception: 100% of his
  //      Net Profit goes to Remaining, 0% is "shared" — he keeps it all
  //      because he owns the business, not because he's an employee being
  //      paid a cut.
  //   3. A branch's totals are just the sum of its technicians' rows, so
  //      "Technician Share" and "Remaining" always add back up to exactly
  //      "Net Profit" — nothing is computed twice or in a disconnected way.
  //   4. Owner-logged Business Expenses (Sales > Expenses) always reduce
  //      the business's own Remaining share, never a technician's share —
  //      a technician's cut only ever depends on their own jobs.
  type TechRow = {
    name: string;
    isExempt: boolean;
    count: number;
    revenue: number;
    jobCost: number;
    netProfit: number;
    share: number;
    remaining: number;
  };
  type BranchTotals = {
    name: string;
    branchId: string | null;
    count: number;
    revenue: number;
    jobCost: number;
    netProfit: number;
    technicianShare: number;
    remaining: number;
    technicians: TechRow[];
  };

  const techByBranch = new Map<string, Map<string, TechRow>>();
  const key = (branchId: string | null) => branchId ?? "unassigned";
  const ensureTech = (branchId: string | null, rawName: string) => {
    const bk = key(branchId);
    const name = rawName.trim() || "Unassigned";
    if (!techByBranch.has(bk)) techByBranch.set(bk, new Map());
    const branchMap = techByBranch.get(bk)!;
    if (!branchMap.has(name)) {
      branchMap.set(name, { name, isExempt: name === EXEMPT_TECHNICIAN_NAME, count: 0, revenue: 0, jobCost: 0, netProfit: 0, share: 0, remaining: 0 });
    }
    return branchMap.get(name)!;
  };

  const branchIdsSeen = new Set<string | null>();
  for (const b of branches) branchIdsSeen.add(b.id);

  for (const r of posSales) {
    branchIdsSeen.add(r.branchId);
    const t = ensureTech(r.branchId, r.technicianName);
    t.count += 1;
    t.revenue += r.cost;
    t.jobCost += r.partsCost + r.laborCost + r.otherExpenses;
  }

  const branchName = (branchId: string | null) => branches.find((b) => b.id === branchId)?.name ?? "Unassigned";

  const rows: BranchTotals[] = Array.from(branchIdsSeen.values())
    .sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return branchName(a).localeCompare(branchName(b));
    })
    .map((branchId) => {
      const techMap = techByBranch.get(key(branchId));
      const technicians = Array.from(techMap?.values() ?? [])
        .map((t) => {
          const netProfit = t.revenue - t.jobCost;
          const share = t.isExempt ? 0 : netProfit * TECHNICIAN_SHARE_RATE;
          const remaining = t.isExempt ? netProfit : netProfit * (1 - TECHNICIAN_SHARE_RATE);
          return { ...t, netProfit, share, remaining };
        })
        .sort((a, b) => {
          if (a.name === "Unassigned") return 1;
          if (b.name === "Unassigned") return -1;
          return b.netProfit - a.netProfit;
        });

      const totals = technicians.reduce(
        (acc, t) => ({
          count: acc.count + t.count,
          revenue: acc.revenue + t.revenue,
          jobCost: acc.jobCost + t.jobCost,
          netProfit: acc.netProfit + t.netProfit,
          technicianShare: acc.technicianShare + t.share,
          remaining: acc.remaining + t.remaining,
        }),
        { count: 0, revenue: 0, jobCost: 0, netProfit: 0, technicianShare: 0, remaining: 0 }
      );

      return { name: branchName(branchId), branchId, technicians, ...totals };
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      revenue: acc.revenue + r.revenue,
      jobCost: acc.jobCost + r.jobCost,
      netProfit: acc.netProfit + r.netProfit,
      technicianShare: acc.technicianShare + r.technicianShare,
      remaining: acc.remaining + r.remaining,
    }),
    { count: 0, revenue: 0, jobCost: 0, netProfit: 0, technicianShare: 0, remaining: 0 }
  );

  // Owner-logged Business Expenses (Sales > Expenses) — whichever target the
  // admin picked when logging it, both land the same place here: reduced
  // out of the business's own Remaining share, never a technician's share.
  // An expense can optionally be tied to one branch (only counts on that
  // branch's card) or left unassigned (counts on every branch's card) —
  // either way it always counts once toward the true combined total below.
  const inRangeExpenses = expenses.filter((e) => inRange(e.expenseDate) && (e.target === "owner_total_sales" || e.target === "owner_final_total_sales"));
  const businessExpensesFor = (branchId: string | null) =>
    inRangeExpenses.filter((e) => e.branchId === null || e.branchId === branchId).reduce((s, e) => s + e.amount, 0);
  const totalBusinessExpenses = inRangeExpenses.reduce((s, e) => s + e.amount, 0);

  const rowsWithExpenses = rows.map((r) => {
    const businessExpenses = businessExpensesFor(r.branchId);
    return { ...r, businessExpenses, businessShareNet: r.remaining - businessExpenses };
  });
  const grandBusinessShareNet = grandTotal.remaining - totalBusinessExpenses;

  const showAllBranches = canViewAllBranchSales(user);
  // The unbranched/backend-only ("Home Service") bucket never gets its own
  // card here — that revenue is tracked on the dedicated Sales > Home
  // Service tab instead, so nobody sees it duplicated in two places.
  const visibleRows = rowsWithExpenses.filter((r) => r.branchId !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Branch Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Walk-in/POS repair revenue by branch. Each technician&apos;s Net Profit splits 50/50 with the business —{" "}
          <strong className="text-slate-600">except {EXEMPT_TECHNICIAN_NAME}</strong>, who is exempt from the split and keeps 100% of his own
          Net Profit as part of the business&apos;s Remaining share. Home service earnings are tracked separately — see the Home Service tab.
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="card">
            <p className="text-xs text-slate-400">Overall Total Income</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{peso(grandTotal.revenue)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Net Profit</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{peso(grandTotal.netProfit)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Technician Share (50%)</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{peso(grandTotal.technicianShare)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Remaining (Business)</p>
            <p className="mt-1 text-2xl font-bold text-blue-300">{peso(grandTotal.remaining)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Total Transactions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{grandTotal.count}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {visibleRows.map((r) => {
          const branchEntry = branches.find((b) => b.id === r.branchId);
          return (
            <div key={r.name} className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{r.name}</h3>
                <p className="text-base font-bold text-green-700">{peso(r.netProfit)} net profit</p>
              </div>

              {/* One linear waterfall — every row flows from the row above it. */}
              <table className="w-full text-left text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">Total Income ({r.count} transactions)</td>
                    <td className="py-2 pr-3 text-right text-slate-800">{peso(r.revenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">− Job Costs (parts/labor/other)</td>
                    <td className="py-2 pr-3 text-right text-red-700">−{peso(r.jobCost)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-3 font-semibold text-slate-800">= Net Profit</td>
                    <td className="py-2 pr-3 text-right font-semibold text-green-700">{peso(r.netProfit)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 pl-5 text-slate-500">Technician Share (50%, excl. {EXEMPT_TECHNICIAN_NAME})</td>
                    <td className="py-2 pr-3 text-right text-amber-700">{peso(r.technicianShare)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-3 pl-5 font-semibold text-slate-700">Remaining (Business Share)</td>
                    <td className="py-2 pr-3 text-right font-semibold text-blue-300">{peso(r.remaining)}</td>
                  </tr>
                  {r.businessExpenses > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">− Business Expenses (Owner)</td>
                        <td className="py-2 pr-3 text-right text-red-700">−{peso(r.businessExpenses)}</td>
                      </tr>
                      <tr>
                        <td className="pt-2 pr-3 font-semibold text-slate-900">= Business Share (Net)</td>
                        <td className="pt-2 pr-3 text-right font-semibold text-blue-300">{peso(r.businessShareNet)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {r.technicians.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Per Technician — Net Profit → Share vs. Remaining
                  </p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 pr-3 font-medium">Technician</th>
                        <th className="pb-2 pr-3 font-medium">Jobs</th>
                        <th className="pb-2 pr-3 font-medium">Revenue</th>
                        <th className="pb-2 pr-3 font-medium">Job Cost</th>
                        <th className="pb-2 pr-3 font-medium">Net Profit</th>
                        <th className="pb-2 pr-3 font-medium">Share (Tech)</th>
                        <th className="pb-2 font-medium">Remaining (Business)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.technicians.map((t) => (
                        <tr key={t.name} className={`border-b border-slate-100 last:border-0 ${t.name === "Unassigned" ? "opacity-60" : ""}`}>
                          <td className="py-2 pr-3 text-slate-700">
                            {t.name}
                            {t.isExempt && (
                              <span className="ml-1.5 badge border border-amber-200 bg-amber-50 text-amber-700">100% — exempt</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-slate-500">{t.count}</td>
                          <td className="py-2 pr-3 text-slate-800">{peso(t.revenue)}</td>
                          <td className="py-2 pr-3 text-red-700">−{peso(t.jobCost)}</td>
                          <td className="py-2 pr-3 font-medium text-slate-800">{peso(t.netProfit)}</td>
                          <td className="py-2 pr-3 text-amber-700">{t.isExempt ? "—" : peso(t.share)}</td>
                          <td className="py-2 text-blue-300">{peso(t.remaining)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold text-slate-900">
                        <td className="pt-2 pr-3">Total</td>
                        <td className="pt-2 pr-3">{r.count}</td>
                        <td className="pt-2 pr-3">{peso(r.revenue)}</td>
                        <td className="pt-2 pr-3 text-red-700">−{peso(r.jobCost)}</td>
                        <td className="pt-2 pr-3">{peso(r.netProfit)}</td>
                        <td className="pt-2 pr-3 text-amber-700">{peso(r.technicianShare)}</td>
                        <td className="pt-2 text-blue-300">{peso(r.remaining)}</td>
                      </tr>
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
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">All Branches — Combined</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-600">Overall Total Income ({grandTotal.count} transactions)</td>
                  <td className="py-2 pr-3 text-right text-slate-800">{peso(grandTotal.revenue)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-600">− Job Costs (parts/labor/other)</td>
                  <td className="py-2 pr-3 text-right text-red-700">−{peso(grandTotal.jobCost)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-3 font-semibold text-slate-800">= Net Profit</td>
                  <td className="py-2 pr-3 text-right font-semibold text-green-700">{peso(grandTotal.netProfit)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 pl-5 text-slate-500">Technician Share (50%, excl. {EXEMPT_TECHNICIAN_NAME})</td>
                  <td className="py-2 pr-3 text-right text-amber-700">{peso(grandTotal.technicianShare)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-3 pl-5 font-semibold text-slate-700">Remaining (Business Share)</td>
                  <td className="py-2 pr-3 text-right font-semibold text-blue-300">{peso(grandTotal.remaining)}</td>
                </tr>
                {totalBusinessExpenses > 0 && (
                  <>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-600">− Business Expenses (Owner, all branches)</td>
                      <td className="py-2 pr-3 text-right text-red-700">−{peso(totalBusinessExpenses)}</td>
                    </tr>
                    <tr>
                      <td className="pt-2 pr-3 font-semibold text-slate-900">= Business Share (Net)</td>
                      <td className="pt-2 pr-3 text-right font-semibold text-blue-300">{peso(grandBusinessShareNet)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
