import Link from "next/link";
import { notFound } from "next/navigation";
import { getSales, getBranches, getRequestById } from "@/lib/db";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sales = await getSales();
  const sale = sales.find((s) => s.id === id);
  if (!sale) notFound();

  const branches = await getBranches();
  const branch = branches.find((b) => b.id === sale.branchId);
  const linkedRequest = sale.homeServiceRequestId ? await getRequestById(sale.homeServiceRequestId) : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/admin/pos" className="text-xs text-slate-400 hover:text-slate-600">
        ← Back to sales
      </Link>

      <div className="card space-y-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ceejay Cellphone Repair Shop</p>
          <p className="text-sm text-slate-500">{branch?.name}</p>
          <p className="mt-2 font-mono text-lg font-bold text-blue-300">{sale.reference}</p>
          <p className="text-xs text-slate-400">{new Date(sale.createdAt).toLocaleString()}</p>
        </div>

        <div className="border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Customer</span>
            <span className="text-slate-800">{sale.customerName}</span>
          </div>
          {sale.customerPhone && (
            <div className="flex justify-between text-slate-500">
              <span>Phone</span>
              <span className="text-slate-800">{sale.customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Cashier</span>
            <span className="text-slate-800">{sale.cashierName}</span>
          </div>
          {linkedRequest && (
            <div className="flex justify-between text-slate-500">
              <span>Linked Job</span>
              <Link href={`/admin/requests/${linkedRequest.id}`} className="font-mono text-blue-300 hover:underline">
                {linkedRequest.reference}
              </Link>
            </div>
          )}
        </div>

        <table className="w-full border-t border-slate-200 pt-3 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pt-3">Item</th>
              <th className="pb-2 pt-3">Qty</th>
              <th className="pb-2 pt-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.lineItems.map((l) => (
              <tr key={l.id}>
                <td className="py-1 text-slate-700">{l.description}</td>
                <td className="py-1 text-slate-500">{l.quantity}</td>
                <td className="py-1 text-right text-slate-700">{peso(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{peso(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Discount</span>
            <span>−{peso(sale.discount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{peso(sale.total)}</span>
          </div>
          <div className="flex justify-between pt-1 text-xs text-slate-400">
            <span>Payment Method</span>
            <span className="uppercase">{sale.paymentMethod}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
