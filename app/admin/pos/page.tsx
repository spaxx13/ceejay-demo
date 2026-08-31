import Link from "next/link";
import { store } from "@/lib/store";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const branches = store.branches;

  let sales = [...store.sales];
  if (sp.branch) sales = sales.filter((s) => s.branchId === sp.branch);
  if (sp.date) sales = sales.filter((s) => s.createdAt.startsWith(sp.date!));
  sales.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = store.sales.filter((s) => s.createdAt.startsWith(today));
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Point of Sale</h1>
          <p className="mt-1 text-sm text-slate-400">Record sales, charge for repairs, and track transaction history.</p>
        </div>
        <Link href="/admin/pos/new" className="btn-primary">
          + New Sale
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Today&apos;s Sales</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{todaySales.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Today&apos;s Revenue</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(todayTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">All-Time Sales</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{store.sales.length}</p>
        </div>
      </div>

      <form className="card flex flex-wrap gap-3">
        <select name="branch" defaultValue={sp.branch ?? ""} className="input w-56">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input type="date" name="date" defaultValue={sp.date ?? ""} className="input w-44" />
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/pos" className="btn-secondary">
          Clear
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Payment</th>
              <th className="pb-2 pr-3">Total</th>
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No sales recorded yet.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{s.reference}</td>
                <td className="py-3 pr-3 text-slate-500">{branchName(s.branchId)}</td>
                <td className="py-3 pr-3 text-slate-800">{s.customerName}</td>
                <td className="py-3 pr-3 text-slate-500 uppercase">{s.paymentMethod}</td>
                <td className="py-3 pr-3 font-semibold text-slate-800">{peso(s.total)}</td>
                <td className="py-3 pr-3 text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="py-3">
                  <Link href={`/admin/pos/${s.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
