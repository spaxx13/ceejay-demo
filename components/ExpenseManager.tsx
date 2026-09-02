"use client";

import { useMemo, useRef, useState } from "react";
import { createExpense, updateExpense, deleteExpense } from "@/lib/actions";
import { formatDate } from "@/lib/format";

type Opt = { id: string; label: string };
type Expense = {
  id: string;
  date: string;
  branchId: string | null;
  categoryId: string | null;
  amount: number;
  description: string;
  recordedBy: string;
};

const peso = (n: number) => `₱${n.toLocaleString()}`;

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseManager({ expenses, branches, categories }: { expenses: Expense[]; branches: Opt[]; categories: Opt[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const editing = expenses.find((e) => e.id === editingId);

  const visible = useMemo(
    () => (branchFilter ? expenses.filter((e) => e.branchId === branchFilter) : expenses),
    [expenses, branchFilter]
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, Expense[]>();
    for (const e of visible) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items, total: items.reduce((sum, i) => sum + i.amount, 0) }));
  }, [visible]);

  function reset() {
    setEditingId(null);
    formRef.current?.reset();
  }
  function labelFor(id: string | null, list: Opt[]) {
    return list.find((x) => x.id === id)?.label ?? "—";
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">{editingId ? "Edit Expense" : "Record Expense"}</h3>
        <form
          ref={formRef}
          action={(fd) => {
            if (editingId) {
              fd.set("id", editingId);
              updateExpense(fd);
            } else {
              createExpense(fd);
            }
            reset();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Date *</label>
              <input name="date" type="date" required defaultValue={editing?.date ?? todayDateStr()} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Branch</label>
              <select name="branchId" defaultValue={editing?.branchId ?? ""} className="input">
                <option value="">— Not branch-specific —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Amount (₱) *</label>
              <input name="amount" type="number" min={0.01} step="0.01" required defaultValue={editing?.amount ?? ""} className="input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Description</label>
              <input name="description" defaultValue={editing?.description ?? ""} className="input" placeholder="e.g. Electricity bill" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save Changes" : "Record Expense"}
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
        <h3 className="text-sm font-semibold text-slate-800">
          Expenses ({visible.length}) · Total {peso(visible.reduce((sum, e) => sum + e.amount, 0))}
        </h3>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="input w-56">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {groups.length === 0 && <div className="card text-center text-slate-400">No expenses recorded yet.</div>}
        {groups.map((g) => (
          <div key={g.date} className="card overflow-x-auto">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">{formatDate(`${g.date}T00:00:00`)}</h4>
              <span className="badge border border-slate-300 bg-slate-100 text-slate-600">{peso(g.total)}</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Branch</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Recorded By</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((e) => (
                  <tr key={e.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-3 pr-3 text-slate-700">{labelFor(e.categoryId, categories)}</td>
                    <td className="py-3 pr-3 text-slate-500">{labelFor(e.branchId, branches)}</td>
                    <td className="py-3 pr-3 text-slate-500">{e.description || "—"}</td>
                    <td className="py-3 pr-3 font-medium text-slate-800">{peso(e.amount)}</td>
                    <td className="py-3 pr-3 text-slate-500">{e.recordedBy}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setEditingId(e.id)}>
                          Edit
                        </button>
                        <form
                          action={(fd) => {
                            if (confirm("Delete this expense entry?")) deleteExpense(fd);
                          }}
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="btn-secondary !px-3 !py-1 text-xs text-red-600">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
