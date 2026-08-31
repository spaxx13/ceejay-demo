"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createSale } from "@/lib/actions";

type Branch = { id: string; label: string };
type InventoryItem = { id: string; branchId: string; name: string; unitPrice: number; quantityOnHand: number };
type RequestOpt = { id: string; reference: string; customerName: string };

type Line = { id: string; kind: "inventory" | "service"; itemId?: string; description: string; quantity: number; unitPrice: number };

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SaleBuilder({
  branches,
  inventoryItems,
  openRequests,
  defaultBranchId,
}: {
  branches: Branch[];
  inventoryItems: InventoryItem[];
  openRequests: RequestOpt[];
  defaultBranchId: string;
}) {
  const [state, formAction, pending] = useActionState(createSale, undefined);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [serviceDesc, setServiceDesc] = useState("");
  const [servicePrice, setServicePrice] = useState(0);

  const branchItems = useMemo(() => inventoryItems.filter((i) => i.branchId === branchId && i.quantityOnHand > 0), [inventoryItems, branchId]);

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);

  function addItemLine() {
    const item = branchItems.find((i) => i.id === selectedItemId);
    if (!item || itemQty <= 0) return;
    setLines((ls) => [...ls, { id: `l-${Date.now()}`, kind: "inventory", itemId: item.id, description: item.name, quantity: itemQty, unitPrice: item.unitPrice }]);
    setSelectedItemId("");
    setItemQty(1);
  }
  function addServiceLine() {
    if (!serviceDesc || servicePrice < 0) return;
    setLines((ls) => [...ls, { id: `l-${Date.now()}`, kind: "service", description: serviceDesc, quantity: 1, unitPrice: servicePrice }]);
    setServiceDesc("");
    setServicePrice(0);
  }
  function removeLine(id: string) {
    setLines((ls) => ls.filter((l) => l.id !== id));
  }

  if (state?.ok) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">Sale recorded!</h2>
        <p className="text-sm text-slate-400">
          Reference: <span className="font-mono text-blue-300">{state.reference}</span>
        </p>
        <div className="flex justify-center gap-2">
          <Link href={`/admin/pos/${state.saleId}`} className="btn-primary">
            View Receipt
          </Link>
          <Link href="/admin/pos/new" className="btn-secondary">
            New Sale
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="discount" value={discount} />

      <div className="space-y-6 lg:col-span-2">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Branch &amp; Customer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Branch *</label>
              <select name="branchId" required value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Link to Home Service Request (optional)</label>
              <select name="homeServiceRequestId" className="input">
                <option value="">None — walk-in / counter sale</option>
                {openRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reference} — {r.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Customer Name</label>
              <input name="customerName" className="input" placeholder="Walk-in Customer" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Customer Phone (optional)</label>
              <input name="customerPhone" className="input" placeholder="0917 123 4567" />
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Inventory Item</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label className="text-[11px] text-slate-400">Item</label>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="input">
                <option value="">Select item...</option>
                {branchItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — {peso(i.unitPrice)} ({i.quantityOnHand} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24 space-y-1">
              <label className="text-[11px] text-slate-400">Qty</label>
              <input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} className="input" />
            </div>
            <button type="button" onClick={addItemLine} className="btn-secondary">
              Add
            </button>
          </div>

          <h3 className="pt-2 text-sm font-semibold text-slate-800">Add Service / Labor Line</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label className="text-[11px] text-slate-400">Description</label>
              <input value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} className="input" placeholder="e.g. Screen repair labor" />
            </div>
            <div className="w-28 space-y-1">
              <label className="text-[11px] text-slate-400">Price (₱)</label>
              <input type="number" min={0} step="0.01" value={servicePrice} onChange={(e) => setServicePrice(Number(e.target.value))} className="input" />
            </div>
            <button type="button" onClick={addServiceLine} className="btn-secondary">
              Add
            </button>
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Line Items</h3>
          {lines.length === 0 && <p className="text-sm text-slate-400">No items added yet.</p>}
          {lines.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Qty</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2 pr-3">Total</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-2 pr-3 text-slate-800">{l.description}</td>
                    <td className="py-2 pr-3 text-slate-500">{l.quantity}</td>
                    <td className="py-2 pr-3 text-slate-500">{peso(l.unitPrice)}</td>
                    <td className="py-2 pr-3 text-slate-700">{peso(l.quantity * l.unitPrice)}</td>
                    <td className="py-2">
                      <button type="button" onClick={() => removeLine(l.id)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Payment</h3>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Payment Method</label>
            <select name="paymentMethod" className="input">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="gcash">GCash</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Discount (₱)</label>
            <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="input" />
          </div>
          <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{peso(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Discount</span>
              <span>−{peso(discount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{peso(total)}</span>
            </div>
          </div>
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending || lines.length === 0} className="btn-primary w-full">
            {pending ? "Charging..." : `Charge ${peso(total)}`}
          </button>
        </div>
      </div>
    </form>
  );
}
