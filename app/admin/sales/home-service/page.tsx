import Link from "next/link";
import { getServiceAgreements, getRequests, homeServiceSalesByTechnician, sumHomeServiceSales } from "@/lib/db";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function HomeServiceSalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [agreements, requests] = await Promise.all([getServiceAgreements(), getRequests()]);

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
  // there), minus that job's visit fee if it's currently waived (Admin >
  // Requests > Waive Service Fee) — reflected here immediately, and
  // reversed immediately if the waiver is later restored from Trash, since
  // this whole report is recomputed from source data on every load. For
  // the 30/70 split, Parts/Material Cost is deducted from that
  // Total Amount to get a Net Amount — an internal-records-only figure,
  // never shown to the customer. Distinct from the Net Profit / 50% split
  // used on the combined By Branch and By Technician reports. Not
  // branch-scoped: this report is organized by technician, and a job's
  // branch tag is incidental (whichever branch the technician was
  // dispatched from), not a meaningful visibility boundary — every account
  // that can open Sales sees all of it.
  const rows = homeServiceSalesByTechnician(agreements, inRange, requests);
  const grandTotal = sumHomeServiceSales(rows);

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

      {rows.length === 0 && <p className="card text-center text-sm text-slate-400">No home service sales recorded for this range.</p>}

      {rows.length > 0 && (
        <>
          {/* Mobile: one stacked card per technician — a 7-column table
              doesn't fit a phone screen, so this reflows the same figures
              as label/value pairs instead of forcing horizontal scroll. */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.name} className={`card space-y-2 ${r.name === "Unassigned" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{r.name}</p>
                  <p className="shrink-0 text-xs text-slate-400">{r.count} job{r.count === 1 ? "" : "s"}</p>
                </div>
                <ul className="space-y-0.5 border-b border-slate-100 pb-2 text-xs text-slate-500">
                  {r.jobs.map((j, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>{j.deviceLabel}</span>
                      <span className="shrink-0 text-slate-400">{peso(j.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-slate-400">Total Amount</span>
                  <span className="text-right text-slate-800">{peso(r.totalAmount)}</span>
                  <span className="text-slate-400">Parts/Material Cost</span>
                  <span className="text-right text-red-700">−{peso(r.partsCost)}</span>
                  <span className="font-medium text-slate-500">Net Amount</span>
                  <span className="text-right font-medium text-slate-900">{peso(r.netAmount)}</span>
                  <span className="text-green-700">Company Share (30%)</span>
                  <span className="text-right text-green-700">{peso(r.companyShare)}</span>
                  <span className="font-medium text-blue-300">Technician Share (70%)</span>
                  <span className="text-right font-medium text-blue-300">{peso(r.technicianShare)}</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Total</p>
                <p className="text-xs text-slate-500">{grandTotal.count} job{grandTotal.count === 1 ? "" : "s"}</p>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-slate-500">Total Amount</span>
                <span className="text-right text-slate-800">{peso(grandTotal.totalAmount)}</span>
                <span className="text-slate-500">Parts/Material Cost</span>
                <span className="text-right text-red-700">−{peso(grandTotal.partsCost)}</span>
                <span className="font-semibold text-slate-700">Net Amount</span>
                <span className="text-right font-semibold text-slate-900">{peso(grandTotal.netAmount)}</span>
                <span className="font-medium text-green-700">Company Share (30%)</span>
                <span className="text-right font-medium text-green-700">{peso(grandTotal.companyShare)}</span>
                <span className="font-medium text-blue-300">Technician Share (70%)</span>
                <span className="text-right font-medium text-blue-300">{peso(grandTotal.technicianShare)}</span>
              </div>
            </div>
          </div>

          {/* Desktop/tablet: full table, same figures. */}
          <div className="hidden card overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Technician</th>
                  <th className="pb-2 pr-3 font-medium">Jobs</th>
                  <th className="pb-2 pr-3 font-medium">Unit(s)</th>
                  <th className="pb-2 pr-3 font-medium">Total Amount</th>
                  <th className="pb-2 pr-3 font-medium">Parts/Material Cost</th>
                  <th className="pb-2 pr-3 font-medium">Net Amount</th>
                  <th className="pb-2 pr-3 font-medium">Company Share (30%)</th>
                  <th className="pb-2 font-medium">Technician Share (70%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className={`border-b border-slate-200 last:border-0 ${r.name === "Unassigned" ? "opacity-60" : ""}`}>
                    <td className="py-3 pr-3 font-medium text-slate-800">{r.name}</td>
                    <td className="py-3 pr-3 text-slate-500">{r.count}</td>
                    <td className="py-3 pr-3 text-slate-500">
                      {r.jobs.map((j, i) => (
                        <span key={i} className="block whitespace-nowrap">
                          {j.deviceLabel}
                        </span>
                      ))}
                    </td>
                    <td className="py-3 pr-3 text-slate-800">{peso(r.totalAmount)}</td>
                    <td className="py-3 pr-3 text-red-700">−{peso(r.partsCost)}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-900">{peso(r.netAmount)}</td>
                    <td className="py-3 pr-3 text-green-700">{peso(r.companyShare)}</td>
                    <td className="py-3 font-semibold text-blue-300">{peso(r.technicianShare)}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-slate-900">
                  <td className="pt-3 pr-3">Total</td>
                  <td className="pt-3 pr-3">{grandTotal.count}</td>
                  <td className="pt-3 pr-3"></td>
                  <td className="pt-3 pr-3 font-normal text-slate-500">{peso(grandTotal.totalAmount)}</td>
                  <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.partsCost)}</td>
                  <td className="pt-3 pr-3">{peso(grandTotal.netAmount)}</td>
                  <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.companyShare)}</td>
                  <td className="pt-3 text-blue-300">{peso(grandTotal.technicianShare)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
