import Link from "next/link";
import { redirect } from "next/navigation";
import { getRepairRecords, getServiceAgreements, getRequests, getCourierRequests, getBranches, getTechnicians, grossSalesRecords } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";
import { formatDate, todayDateStr } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Non-VAT Percentage Tax rate (BIR Form 2551Q) — the only rate this page
// computes. A VAT-registered business' gross sales need a different
// breakdown (VATable Sales + 12% Output VAT) that this page doesn't do.
const PERCENTAGE_TAX_RATE = 0.03;

export default async function BirRecordsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  if (!(await requireRole("owner_admin"))) redirect("/admin/sales");

  const sp = await searchParams;
  const [repairRecords, agreements, requests, courierRequests, branches, technicians] = await Promise.all([
    getRepairRecords(),
    getServiceAgreements(),
    getRequests(),
    getCourierRequests(),
    getBranches(),
    getTechnicians(),
  ]);

  // Default to this calendar month (Manila) — a more useful BIR-filing
  // default than "today" alone, since Percentage Tax is filed quarterly but
  // most owners reconcile month by month. An explicit From/To overrides it.
  const today = todayDateStr();
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const hasFilter = !!(sp.from || sp.to);
  const from = hasFilter ? sp.from : defaultFrom;
  const to = hasFilter ? sp.to : today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  const records = grossSalesRecords(repairRecords, agreements, requests, courierRequests, branches, technicians, inRange);
  const grossTotal = records.reduce((s, r) => s + r.amount, 0);
  const estimatedTax = grossTotal * PERCENTAGE_TAX_RATE;

  const exportHref = `/api/admin/sales/bir-export?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">BIR Records</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every peso billed to a customer across POS, Home Service, Pickup &amp; Delivery, and Courier Service, in one list — for handing to
          your accountant or bookkeeper, not a BIR-accredited receipt in itself. Assumes Non-VAT (Percentage Tax, 3% of gross sales/receipts
          — BIR Form 2551Q); a VAT-registered business needs a different breakdown this page doesn&apos;t compute.
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
        <Link href="/admin/sales/bir-records" className="btn-secondary">
          Reset to This Month
        </Link>
        <a href={exportHref} className="btn-primary ml-auto">
          Download CSV
        </a>
      </form>
      {!hasFilter && <p className="-mt-3 text-xs text-slate-400">Showing this month so far ({defaultFrom} to {today}). Set a date range above for a different period.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Gross Sales / Receipts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(grossTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Estimated Percentage Tax (3%)</p>
          <p className="mt-1 text-2xl font-bold text-blue-300">{peso(estimatedTax)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{records.length}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Source</th>
              <th className="pb-2 pr-3 font-medium">Reference</th>
              <th className="pb-2 pr-3 font-medium">Customer</th>
              <th className="pb-2 pr-3 font-medium">Branch</th>
              <th className="pb-2 pr-3 font-medium">Device</th>
              <th className="pb-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No sales recorded for this range.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={`${r.source}-${r.id}`} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{r.source}</td>
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{r.branchName}</td>
                <td className="py-3 pr-3 text-slate-500">{r.deviceLabel}</td>
                <td className="py-3 font-semibold text-slate-800">{peso(r.amount)}</td>
              </tr>
            ))}
            {records.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3" colSpan={6}>
                  Total
                </td>
                <td className="pt-3">{peso(grossTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
