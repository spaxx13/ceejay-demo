import { getQuotations, getBranches } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function QuotationsPage() {
  const [quotations, branches] = await Promise.all([getQuotations(), getBranches()]);
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Quotations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every quotation a customer built and sent themselves from the public Get a Quote page — read-only, for tracking.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Total Quotations</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{quotations.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Home Service</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{quotations.filter((q) => q.deliveryMethod === "home_service").length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Walk-in</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{quotations.filter((q) => q.deliveryMethod === "walk_in").length}</p>
        </div>
      </div>

      {/* Mobile: one card per quotation. */}
      <div className="space-y-3 sm:hidden">
        {quotations.length === 0 && <p className="card text-center text-sm text-slate-400">No quotations yet.</p>}
        {quotations.map((q) => (
          <div key={q.id} className="card space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-blue-300">{q.reference}</p>
              <span className="shrink-0 text-xs text-slate-500">{q.deliveryMethod === "home_service" ? "Home Service" : "Walk-in"}</span>
            </div>
            <p className="text-sm text-slate-800">{q.customerName}</p>
            <p className="text-xs text-slate-500 break-all">{q.email}</p>
            <p className="text-sm font-semibold text-slate-900">{q.total !== null ? peso(q.total) : "Confirmed upon inspection"}</p>
            <p className="text-xs text-slate-400">
              {formatDateTime(q.createdAt)} · {q.emailedAt ? "Emailed" : "Email failed"}
            </p>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">Delivery</th>
              <th className="pb-2 pr-3">Items</th>
              <th className="pb-2 pr-3">Total</th>
              <th className="pb-2 pr-3">Emailed</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400">
                  No quotations yet.
                </td>
              </tr>
            )}
            {quotations.map((q) => (
              <tr key={q.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono font-medium text-blue-300">{q.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{q.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{q.email}</td>
                <td className="py-3 pr-3 text-slate-500">
                  {q.deliveryMethod === "home_service" ? `Home Service — ${[q.city, q.province].filter(Boolean).join(", ")}` : `Walk-in${branchName(q.branchId) ? ` — ${branchName(q.branchId)}` : ""}`}
                </td>
                <td className="py-3 pr-3 text-slate-500">{q.lineItems.length}</td>
                <td className="py-3 pr-3 font-semibold text-slate-900">{q.total !== null ? peso(q.total) : "Confirmed upon inspection"}</td>
                <td className="py-3 pr-3 text-slate-500">{q.emailedAt ? "Yes" : "Failed"}</td>
                <td className="py-3 text-slate-500">{formatDateTime(q.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
