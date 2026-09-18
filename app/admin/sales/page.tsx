import Link from "next/link";
import { getBranches, getRepairRecords, getExpenses, getTechnicians, isBranchHidden, canViewAllBranchSales, technicianSharePercent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";
import BarBreakdownChart from "@/components/BarBreakdownChart";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BranchSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, allBranches, repairRecords, expenses, technicians] = await Promise.all([
    getCurrentUser(),
    getBranches(),
    getRepairRecords(),
    getExpenses(),
    getTechnicians(),
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
  //      (Business) share, using THAT technician's own earnings share
  //      percent (Settings > Technicians — e.g. 50%, 70%, or 100% for an
  //      owner-technician who keeps everything). Same lookup as every other
  //      Sales report, so none of them can disagree with each other.
  //   3. A branch's totals are just the sum of its technicians' rows, so
  //      "Technician Share" and "Remaining" always add back up to exactly
  //      "Net Profit" — nothing is computed twice or in a disconnected way.
  //   4. Owner-logged Business Expenses (Sales > Expenses) reduce one of
  //      two things depending on which target the owner picked: "Net
  //      Profit (Before Sharing)" expenses shrink the pool BEFORE it's
  //      split, so they do proportionally reduce a technician's share too
  //      (see the scaling step below); "Owner's Final Total Sales"
  //      expenses only ever reduce the business's own Remaining share,
  //      after the split, never touching what a technician already earned.
  type TechRow = {
    name: string;
    sharePercent: number;
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
      branchMap.set(name, { name, sharePercent: technicianSharePercent(name, technicians), count: 0, revenue: 0, jobCost: 0, netProfit: 0, share: 0, remaining: 0 });
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
          // A 100% share means this technician IS the business (an
          // owner-technician) — their full Net Profit is the business's own
          // money, not a payout to a separate party, so it belongs entirely
          // under Remaining, never under Technician Share.
          const share = t.sharePercent >= 100 ? 0 : netProfit * (t.sharePercent / 100);
          const remaining = netProfit - share;
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

  // Owner-logged Business Expenses (Sales > Expenses) — two buckets,
  // deducted at two different waterfall stages, neither ever touching a
  // technician's own share (see note 4 above):
  //   - "Net Profit (Before Sharing)" expenses come out of Net Profit
  //     itself, before the technician-share split even happens.
  //   - "Owner's Final Total Sales" expenses come out only of the
  //     business's own Remaining share, after that split.
  // An expense can optionally be tied to one branch (only counts on that
  // branch's card) or left unassigned (counts on every branch's card) —
  // either way it always counts once toward the true combined total below.
  const netProfitExpenseRows = expenses.filter((e) => inRange(e.expenseDate) && e.target === "owner_total_sales");
  const remainingExpenseRows = expenses.filter((e) => inRange(e.expenseDate) && e.target === "owner_final_total_sales");
  // "Technician's Final Total Sales" expenses always name a technician —
  // deducted straight from that technician's own Share, same as the By
  // Technician report (never spread proportionally like Net Profit ones).
  const technicianExpenseRows = expenses.filter((e) => inRange(e.expenseDate) && e.target === "technician_final_total_sales");
  const amountFor = (list: typeof expenses, branchId: string | null) =>
    list.filter((e) => e.branchId === null || e.branchId === branchId).reduce((s, e) => s + e.amount, 0);
  const totalNetProfitExpenses = netProfitExpenseRows.reduce((s, e) => s + e.amount, 0);
  const totalBusinessExpenses = remainingExpenseRows.reduce((s, e) => s + e.amount, 0);
  const totalTechnicianExpenses = technicianExpenseRows.reduce((s, e) => s + e.amount, 0);

  // "Net Profit (Before Sharing)" expenses shrink the pool that actually
  // gets divided. An expense can optionally be tied to one technician (the
  // owner picks them when logging it) — that one comes straight out of
  // that technician's own Net Profit before their share is computed.
  // Anything left un-tied to a technician is spread proportionally across
  // every technician at the branch instead, same as before. Either way,
  // Share and Remaining (branch totals and each technician's own row)
  // still add back up to exactly Net Profit (Before Sharing) — Revenue/Job
  // Cost/Net Profit stay factual and untouched, only the split moves.
  const rowsWithExpenses = rows.map((r) => {
    const branchNetProfitExpenseRows = netProfitExpenseRows.filter((e) => e.branchId === null || e.branchId === r.branchId);
    const techNames = new Set(r.technicians.map((t) => t.name));
    const targetedExpensesByTech = new Map<string, number>();
    let unassignedNetProfitExpenses = 0;
    for (const e of branchNetProfitExpenseRows) {
      if (e.technicianName && techNames.has(e.technicianName)) {
        targetedExpensesByTech.set(e.technicianName, (targetedExpensesByTech.get(e.technicianName) ?? 0) + e.amount);
      } else {
        unassignedNetProfitExpenses += e.amount;
      }
    }
    const netProfitExpenses = branchNetProfitExpenseRows.reduce((s, e) => s + e.amount, 0);
    const netProfitBeforeSharing = r.netProfit - netProfitExpenses;

    const branchTechnicianExpenseRows = technicianExpenseRows.filter((e) => e.branchId === null || e.branchId === r.branchId);

    const technicians = r.technicians.map((t) => {
      const unassignedShare = r.netProfit !== 0 ? unassignedNetProfitExpenses * (t.netProfit / r.netProfit) : 0;
      const tNetProfitBeforeSharing = t.netProfit - (targetedExpensesByTech.get(t.name) ?? 0) - unassignedShare;
      const scale = t.netProfit !== 0 ? tNetProfitBeforeSharing / t.netProfit : 1;
      const share = t.share * scale;
      const remaining = tNetProfitBeforeSharing - share;
      // "Technician's Final Total Sales" expenses always name a technician
      // and come straight out of their Share — except a 100%-share
      // (owner-technician) whose Share is always ₱0, so it comes out of
      // their Remaining instead, same convention as the By Technician report.
      const isFullShare = t.sharePercent >= 100;
      const techFinalExpense = branchTechnicianExpenseRows.filter((e) => e.technicianName === t.name).reduce((s, e) => s + e.amount, 0);
      const shareNet = isFullShare ? share : share - techFinalExpense;
      const remainingNet = isFullShare ? remaining - techFinalExpense : remaining;
      // What THIS technician actually takes home after their own expense —
      // their Share for a normal technician, or their Remaining for a
      // 100%-share owner-technician (whose Share is always ₱0). Never
      // Share+Remaining combined — Remaining is the business's money, not theirs.
      const netAfterExpenses = isFullShare ? remainingNet : shareNet;
      return { ...t, share, remaining, techFinalExpense, shareNet, remainingNet, netAfterExpenses };
    });
    const technicianShare = technicians.reduce((s, t) => s + t.share, 0);
    const technicianExpenses = technicians.reduce((s, t) => s + t.techFinalExpense, 0);
    const technicianShareNet = technicians.reduce((s, t) => s + t.shareNet, 0);
    const technicianNetAfterExpenses = technicians.reduce((s, t) => s + t.netAfterExpenses, 0);
    const remaining = technicians.reduce((s, t) => s + t.remainingNet, 0);
    const businessExpenses = amountFor(remainingExpenseRows, r.branchId);
    return {
      ...r,
      technicians,
      netProfitExpenses,
      netProfitBeforeSharing,
      technicianShare,
      technicianExpenses,
      technicianShareNet,
      technicianNetAfterExpenses,
      remaining,
      businessExpenses,
      businessShareNet: remaining - businessExpenses,
    };
  });
  const grandNetProfitBeforeSharing = grandTotal.netProfit - totalNetProfitExpenses;
  const grandScale = grandTotal.netProfit !== 0 ? grandNetProfitBeforeSharing / grandTotal.netProfit : 1;
  const grandTechnicianShare = grandTotal.technicianShare * grandScale;
  // Approximates the same way grandScale already does — a 100%-share
  // (owner-technician) whose own expense should spill into Remaining
  // instead of Share is a rare edge case, so this combined summary treats
  // every technician expense as coming out of Share; each branch card
  // below gets it exactly right per technician.
  const grandTechnicianShareNet = grandTechnicianShare - totalTechnicianExpenses;
  const grandRemaining = grandNetProfitBeforeSharing - grandTechnicianShare;
  const grandBusinessShareNet = grandRemaining - totalBusinessExpenses;

  const showAllBranches = canViewAllBranchSales(user);
  // The unbranched/backend-only ("Home Service") bucket never gets its own
  // card here — that revenue is tracked on the dedicated Sales > Home
  // Service tab instead, so nobody sees it duplicated in two places.
  const visibleRows = rowsWithExpenses.filter((r) => r.branchId !== null);

  const revenueByBranch = visibleRows.map((r) => ({ label: r.name, value: r.revenue })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Branch Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Walk-in/POS repair revenue by branch. Each technician&apos;s Net Profit splits by their own earnings share (set per technician on{" "}
          <Link href="/admin/technicians" className="underline">
            Settings &gt; Technicians
          </Link>
          ) — the rest is the business&apos;s Remaining share. Home service earnings are tracked separately — see the Home Service tab.
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
            <p className="text-xs text-slate-400">Technician Share</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{peso(grandTechnicianShare)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Remaining (Business)</p>
            <p className="mt-1 text-2xl font-bold text-blue-300">{peso(grandRemaining)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Total Transactions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{grandTotal.count}</p>
          </div>
        </div>
      )}

      {showAllBranches && visibleRows.length > 1 && (
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Revenue by Branch</h3>
          <BarBreakdownChart data={revenueByBranch} formatValue={peso} emptyMessage="No sales in this range yet." />
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
                  {r.netProfitExpenses > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">− Business Expenses (Net Profit)</td>
                        <td className="py-2 pr-3 text-right text-red-700">−{peso(r.netProfitExpenses)}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="py-2 pr-3 font-semibold text-slate-800">= Net Profit (Before Sharing)</td>
                        <td className="py-2 pr-3 text-right font-semibold text-green-700">{peso(r.netProfitBeforeSharing)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 pl-5 text-slate-500">Technician Share (per technician&apos;s own %)</td>
                    <td className="py-2 pr-3 text-right text-amber-700">{peso(r.technicianShare)}</td>
                  </tr>
                  {r.technicianExpenses > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 pl-5 text-slate-600">− Business Expenses (Technician)</td>
                        <td className="py-2 pr-3 text-right text-red-700">−{peso(r.technicianExpenses)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 pr-3 pl-5 font-semibold text-slate-700">Technician Share (Net)</td>
                        <td className="py-2 pr-3 text-right font-semibold text-amber-700">{peso(r.technicianShareNet)}</td>
                      </tr>
                    </>
                  )}
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

                  {/* Mobile: one stacked card per technician — an 8-column table
                      doesn't fit a phone screen, so this reflows the same
                      figures as label/value pairs instead of forcing horizontal
                      scroll on the whole page. */}
                  <div className="space-y-2 sm:hidden">
                    {r.technicians.map((t) => (
                      <div key={t.name} className={`rounded-lg border border-slate-200 p-3 ${t.name === "Unassigned" ? "opacity-60" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">
                            {t.name}
                            {t.sharePercent >= 100 && (
                              <span className="ml-1.5 badge border border-amber-200 bg-amber-50 text-amber-700">100% — owner</span>
                            )}
                          </p>
                          <p className="shrink-0 text-xs text-slate-400">{t.count} job{t.count === 1 ? "" : "s"}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1 text-xs">
                          <span className="text-slate-400">Revenue</span>
                          <span className="text-right text-slate-800">{peso(t.revenue)}</span>
                          <span className="text-slate-400">Job Cost</span>
                          <span className="text-right text-red-700">−{peso(t.jobCost)}</span>
                          <span className="font-medium text-slate-500">Net Profit</span>
                          <span className="text-right font-medium text-slate-800">{peso(t.netProfit)}</span>
                          <span className="text-slate-400">Split</span>
                          <span className="text-right text-slate-500">
                            {t.sharePercent}% tech / {100 - t.sharePercent}% biz
                          </span>
                          <span className="text-amber-700">Share (Tech)</span>
                          <span className="text-right text-amber-700">{t.sharePercent >= 100 ? "—" : peso(t.share)}</span>
                          <span className="text-blue-300">Remaining (Biz)</span>
                          <span className="text-right text-blue-300">{peso(t.remaining)}</span>
                          {t.techFinalExpense > 0 && (
                            <>
                              <span className="text-slate-400">Business Expenses</span>
                              <span className="text-right text-red-700">−{peso(t.techFinalExpense)}</span>
                              <span className="font-medium text-slate-700">
                                {t.sharePercent >= 100 ? "Net (After Expenses)" : "Technician Share (Net)"}
                              </span>
                              <span className="text-right font-medium text-slate-900">{peso(t.netAfterExpenses)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Total</p>
                        <p className="text-xs text-slate-500">{r.count} job{r.count === 1 ? "" : "s"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs">
                        <span className="text-slate-500">Revenue</span>
                        <span className="text-right text-slate-800">{peso(r.revenue)}</span>
                        <span className="text-slate-500">Job Cost</span>
                        <span className="text-right text-red-700">−{peso(r.jobCost)}</span>
                        <span className="font-semibold text-slate-700">Net Profit</span>
                        <span className="text-right font-semibold text-slate-900">{peso(r.netProfit)}</span>
                        <span className="font-medium text-amber-700">Share (Tech)</span>
                        <span className="text-right font-medium text-amber-700">{peso(r.technicianShare)}</span>
                        <span className="font-medium text-blue-300">Remaining (Biz)</span>
                        <span className="text-right font-medium text-blue-300">{peso(r.remaining)}</span>
                        {r.technicianExpenses > 0 && (
                          <>
                            <span className="text-slate-500">Business Expenses</span>
                            <span className="text-right text-red-700">−{peso(r.technicianExpenses)}</span>
                            <span className="font-semibold text-slate-900">Technician Share (Net)</span>
                            <span className="text-right font-semibold text-slate-900">{peso(r.technicianNetAfterExpenses)}</span>
                          </>
                        )}
                        <span className="font-semibold text-slate-900">Business Share (Net)</span>
                        <span className="text-right font-semibold text-slate-900">{peso(r.businessShareNet)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop/tablet: full table, same figures. */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-2 pr-3 font-medium">Technician</th>
                          <th className="pb-2 pr-3 font-medium">Jobs</th>
                          <th className="pb-2 pr-3 font-medium">Revenue</th>
                          <th className="pb-2 pr-3 font-medium">Job Cost</th>
                          <th className="pb-2 pr-3 font-medium">Net Profit</th>
                          <th className="pb-2 pr-3 font-medium">Split</th>
                          <th className="pb-2 pr-3 font-medium">Share (Tech)</th>
                          <th className="pb-2 pr-3 font-medium">Remaining (Business)</th>
                          <th className="pb-2 pr-3 font-medium">Business Expenses</th>
                          <th className="pb-2 pr-3 font-medium">Technician Share (Net)</th>
                          <th className="pb-2 font-medium">Business Share (Net)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.technicians.map((t) => (
                          <tr key={t.name} className={`border-b border-slate-100 last:border-0 ${t.name === "Unassigned" ? "opacity-60" : ""}`}>
                            <td className="py-2 pr-3 text-slate-700">
                              {t.name}
                              {t.sharePercent >= 100 && (
                                <span className="ml-1.5 badge border border-amber-200 bg-amber-50 text-amber-700">100% — owner</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-500">{t.count}</td>
                            <td className="py-2 pr-3 text-slate-800">{peso(t.revenue)}</td>
                            <td className="py-2 pr-3 text-red-700">−{peso(t.jobCost)}</td>
                            <td className="py-2 pr-3 font-medium text-slate-800">{peso(t.netProfit)}</td>
                            <td className="py-2 pr-3 text-slate-500">{t.sharePercent}% tech / {100 - t.sharePercent}% biz</td>
                            <td className="py-2 pr-3 text-amber-700">{t.sharePercent >= 100 ? "—" : peso(t.share)}</td>
                            <td className="py-2 pr-3 text-blue-300">{peso(t.remaining)}</td>
                            <td className="py-2 pr-3 text-red-700">−{peso(t.techFinalExpense)}</td>
                            <td className="py-2 pr-3 font-medium text-slate-900">{peso(t.netAfterExpenses)}</td>
                            <td className="py-2 text-slate-400">—</td>
                          </tr>
                        ))}
                        <tr className="font-semibold text-slate-900">
                          <td className="pt-2 pr-3">Total</td>
                          <td className="pt-2 pr-3">{r.count}</td>
                          <td className="pt-2 pr-3">{peso(r.revenue)}</td>
                          <td className="pt-2 pr-3 text-red-700">−{peso(r.jobCost)}</td>
                          <td className="pt-2 pr-3">{peso(r.netProfit)}</td>
                          <td className="pt-2 pr-3"></td>
                          <td className="pt-2 pr-3 text-amber-700">{peso(r.technicianShare)}</td>
                          <td className="pt-2 pr-3 text-blue-300">{peso(r.remaining)}</td>
                          <td className="pt-2 pr-3 text-red-700">−{peso(r.technicianExpenses)}</td>
                          <td className="pt-2 pr-3">{peso(r.technicianNetAfterExpenses)}</td>
                          <td className="pt-2">{peso(r.businessShareNet)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
                {totalNetProfitExpenses > 0 && (
                  <>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-600">− Business Expenses (Net Profit)</td>
                      <td className="py-2 pr-3 text-right text-red-700">−{peso(totalNetProfitExpenses)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 pr-3 font-semibold text-slate-800">= Net Profit (Before Sharing)</td>
                      <td className="py-2 pr-3 text-right font-semibold text-green-700">{peso(grandNetProfitBeforeSharing)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 pl-5 text-slate-500">Technician Share (per technician&apos;s own %)</td>
                  <td className="py-2 pr-3 text-right text-amber-700">{peso(grandTechnicianShare)}</td>
                </tr>
                {totalTechnicianExpenses > 0 && (
                  <>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 pr-3 pl-5 text-slate-600">− Business Expenses (Technician, all branches)</td>
                      <td className="py-2 pr-3 text-right text-red-700">−{peso(totalTechnicianExpenses)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 pr-3 pl-5 font-semibold text-slate-700">Technician Share (Net)</td>
                      <td className="py-2 pr-3 text-right font-semibold text-amber-700">{peso(grandTechnicianShareNet)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-3 pl-5 font-semibold text-slate-700">Remaining (Business Share)</td>
                  <td className="py-2 pr-3 text-right font-semibold text-blue-300">{peso(grandRemaining)}</td>
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
