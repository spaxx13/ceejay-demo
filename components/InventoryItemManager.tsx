"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { createInventoryItem, updateInventoryItem, toggleInventoryItemActive, adjustStock } from "@/lib/actions";

type Opt = { id: string; label: string };
type Item = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  branchId: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number;
  unitPrice: number;
  active: boolean;
};

const peso = (n: number) => `₱${n.toLocaleString()}`;

export default function InventoryItemManager({ items, branches, categories }: { items: Item[]; branches: Opt[]; categories: Opt[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const editing = items.find((i) => i.id === editingId);

  const visible = useMemo(() => (branchFilter ? items.filter((i) => i.branchId === branchFilter) : items), [items, branchFilter]);

  function reset() {
    setEditingId(null);
    formRef.current?.reset();
  }
  function labelFor(id: string, list: Opt[]) {
    return list.find((x) => x.id === id)?.label ?? "—";
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Item" : "Add Inventory Item"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateInventoryItem(fd);
            } else {
              createInventoryItem(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">SKU</label>
              <input name="sku" defaultValue={editing?.sku ?? ""} className="input" placeholder="e.g. SCR-IP14-BLK" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Item Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ""} className="input" placeholder="e.g. iPhone 14 Screen Assembly" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Category</label>
              <select name="categoryId" defaultValue={editing?.categoryId ?? categories[0]?.id ?? ""} className="input">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Branch *</label>
              <select name="branchId" required defaultValue={editing?.branchId ?? branches[0]?.id ?? ""} className="input">
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {!editingId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Starting Qty</label>
                <input name="quantityOnHand" type="number" min={0} defaultValue={0} className="input" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Reorder Level</label>
              <input name="reorderLevel" type="number" min={0} defaultValue={editing?.reorderLevel ?? 3} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Unit Amount (₱)</label>
              <input name="unitCost" type="number" min={0} step="0.01" defaultValue={editing?.unitCost ?? 0} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Unit Price (₱)</label>
              <input name="unitPrice" type="number" min={0} step="0.01" defaultValue={editing?.unitPrice ?? 0} className="input" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Add Item"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Items ({visible.length})</h3>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="input w-56">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Item</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Category</th>
              <th className="pb-2 pr-3">Qty</th>
              <th className="pb-2 pr-3">Price</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No inventory items yet.
                </td>
              </tr>
            )}
            {visible.map((item) => {
              const low = item.quantityOnHand <= item.reorderLevel;
              return (
                <Fragment key={item.id}>
                  <tr className="border-b border-slate-200 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{item.sku || "—"}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{labelFor(item.branchId, branches)}</td>
                    <td className="py-3 pr-3 text-slate-500">{labelFor(item.categoryId, categories)}</td>
                    <td className="py-3 pr-3">
                      <span className={low ? "font-semibold text-amber-700" : "text-slate-700"}>{item.quantityOnHand}</span>
                      {low && <span className="badge ml-1.5 border border-amber-200 bg-amber-50 text-amber-700">Low</span>}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{peso(item.unitPrice)}</td>
                    <td className="py-3 pr-3">
                      <form action={toggleInventoryItemActive}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className={`badge border ${item.active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}
                        >
                          {item.active ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setEditingId(item.id)}>
                          Edit
                        </button>
                        <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setAdjustingId(adjustingId === item.id ? null : item.id)}>
                          Adjust Stock
                        </button>
                      </div>
                    </td>
                  </tr>
                  {adjustingId === item.id && (
                    <tr className="border-b border-slate-200 bg-slate-50/50 last:border-0">
                      <td colSpan={7} className="py-3">
                        <form
                          action={(fd) => {
                            adjustStock(fd);
                            setAdjustingId(null);
                          }}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="itemId" value={item.id} />
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Type</label>
                            <select name="type" className="input w-36">
                              <option value="in">Stock In</option>
                              <option value="out">Stock Out</option>
                              <option value="adjustment">Adjustment (set count)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Quantity</label>
                            <input name="quantity" type="number" min={0} required className="input w-24" />
                          </div>
                          <div className="space-y-1 flex-1 min-w-[180px]">
                            <label className="text-[11px] text-slate-400">Reason</label>
                            <input name="reason" className="input" placeholder="e.g. Restock from supplier" />
                          </div>
                          <button type="submit" className="btn-primary !px-3 !py-2 text-xs">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
