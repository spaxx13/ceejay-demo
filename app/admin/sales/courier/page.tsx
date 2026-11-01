import Link from "next/link";
import { redirect } from "next/navigation";
import { getCourierRequests, getBranches, isBranchHidden, canManageCourier } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";
import { todayDateStr, toManilaDateStr, formatDate } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mirrors Sales > Pickup & Delivery's shape (same filter form, same mobile/
// desktop split) but grouped by branch instead of by technician — a courier
// job has no technician share to split, just a repair cost credited to
// whichever branch the device was shipped to.
export default async function CourierSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getCurrentUser();
  // Same dial as Admin > Courier Service — the owner picks who sees it.
  if (!canManageCourier(user)) redirect("/admin/sales");
  const sp = await searchParams;
  const [courierRequests, allBranches] = await Promise.all([getCourierRequests(), getBranches()]);

  const today = todayDateStr();
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : today;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  // Real (addressed) branches only, same as Branch Sales — Courier jobs
  // ship to a physical branch, never a Home Service queue bucket.
  const branches = allBranches.filter((b) => !isBranchHidden(user, b.id) && b.address);

  // Paid-in-range jobs, counted at the repair cost only — the return
  // shipping fee goes to the courier, same exclusion Branch Sales always
  // applied here.
  const rows = branches.map((b) => {
    const jobs = courierRequests
      .filter(
        (c) =>
          c.branchId === b.id &&
          c.status !== "cancelled" &&
          c.paidAt &&
          c.repairCost !== null &&
          inRange(toManilaDateStr(c.paidAt)) &&
          !isBranchHidden(user, c.branchId)
      )
      .sort((a, b2) => ((a.paidAt ?? "") < (b2.paidAt ?? "") ? 1 : -1));
    const total = jobs.reduce((s, c) => s + (c.repairCost ?? 0), 0);
    return { branch: b, jobs, total };
  });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandCount = rows.reduce((s, r) => s + r.jobs.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Courier Service Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each branch&apos;s Courier Service earnings, counted at the repair cost only — the return shipping fee goes to the courier, so it&apos;s never
          part of this total. A job counts on the day its payment was confirmed, same as the Courier Service queue itself.
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
        <Link href="/admin/sales/courier" className="btn-secondary">
          Reset to Today
        </Link>
      </form>
      {!hasFilter && <p className="-mt-3 text-xs text-slate-400">Showing today&apos;s sales ({today}). Set a date range above to see other days.</p>}

      <div className="card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">All Branches — Combined</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {grandCount} job{grandCount === 1 ? "" : "s"} paid
          </span>
          <span className="rounded-md border-2 border-green-300 bg-green-50 px-2.5 py-1 text-base font-bold text-green-900">{peso(grandTotal)}</span>
        </div>
      </div>

      {rows.length === 0 && <p className="card text-center text-sm text-slate-400">No branches to show.</p>}

      {rows.map(({ branch, jobs, total }) => (
        <div key={branch.id} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{branch.name}</h3>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {jobs.length} paid
            </span>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-400">No Courier Service payments confirmed in this range.</p>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-800">Total Repair Cost</td>
                    <td className="py-2 pr-3 text-right font-semibold text-green-700">{peso(total)}</td>
                  </tr>
                </tbody>
              </table>
              <ul className="space-y-1 text-sm">
                {jobs.map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-x-3 text-slate-600">
                    <Link href={`/admin/courier/${c.id}`} className="font-mono text-xs text-blue-500 hover:underline">
                      {c.reference}
                    </Link>
                    <span>{c.name}</span>
                    <span className="text-xs text-slate-400">{c.paidAt ? formatDate(c.paidAt) : ""}</span>
                    <span className="text-slate-800">{peso(c.repairCost ?? 0)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400">Repair cost only — the return shipping fee goes to the courier. Counted on the day payment was confirmed.</p>
            </>
          )}
          {jobs.length > 0 && (
            <Link href="/admin/courier" className="btn-secondary inline-block !px-3 !py-1 text-xs">
              View Courier Records
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
