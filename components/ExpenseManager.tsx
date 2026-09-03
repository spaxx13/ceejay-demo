"use client";

import { useRef, useState } from "react";
import { createExpense, deleteExpense } from "@/lib/actions";
import type { ExpenseTarget } from "@/lib/types";

type Branch = { id: string; name: string };
type ExpenseRow = {
  id: string;
  description: string;
  amount: number;
  target: ExpenseTarget;
  technicianName: string | null;
  branchId: string | null;
  expenseDate: string;
  createdBy: string;
};

const TARGET_LABELS: Record<ExpenseTarget, string> = {
  owner_final_total_sales: "Owner's Final Total Sales",
  owner_total_sales: "Total Sales of the Owner",
  technician_final_total_sales: "Technician's Final Total Sales",
};

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpenseManager({ expenses, branches }: { expenses: ExpenseRow[]; branches: Branch[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState<ExpenseTarget>("owner_final_total_sales");
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? null;

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Log a Business Expense</h3>
        <form
          ref={formRef}
          action={(fd) => {
            createExpense(fd);
            formRef.current?.reset();
            setTarget("owner_final_total_sales");
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Description *</label>
              <input name="description" required className="input" placeholder="e.g. Shop rent, tools, utilities" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Amount (₱) *</label>
              <input name="amount" type="number" min={0.01} step="0.01" required className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Deduct From *</label>
              <select name="target" required value={target} onChange={(e) => setTarget(e.target.value as ExpenseTarget)} className="input">
                <option value="owner_final_total_sales">Owner&apos;s Final Total Sales</option>
                <option value="owner_total_sales">Total Sales of the Owner</option>
                <option value="technician_final_total_sales">Technician&apos;s Final Total Sales</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Date</label>
              <input type="date" value={new Date().toISOString().slice(0, 10)} disabled className="input disabled:opacity-70" />
              <p className="text-[11px] text-slate-400">Expenses are recorded on the day they&apos;re logged.</p>
            </div>
          </div>
          {target === "technician_final_total_sales" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Technician *</label>
              <input name="technicianName" required className="input" placeholder="Type technician's name" />
              <p className="text-[11px] text-slate-400">
                Spell it exactly as it appears on the Sales by Technician report so this expense is matched to the right technician.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Branch *</label>
            <select name="branchId" required defaultValue="" className="input">
              <option value="" disabled>
                Select branch...
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">This expense is deducted only from the selected branch&apos;s card.</p>
            {branches.length === 0 && <p className="text-[11px] text-amber-700">No branches available to this account.</p>}
          </div>
          <button type="submit" className="btn-primary">
            Add Expense
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">Description</th>
              <th className="pb-2 pr-3">Deducted From</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Amount</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No expenses logged yet.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 text-slate-500">{e.expenseDate}</td>
                <td className="py-3 pr-3 text-slate-800">{e.description}</td>
                <td className="py-3 pr-3 text-slate-500">
                  {TARGET_LABELS[e.target]}
                  {e.technicianName && ` — ${e.technicianName}`}
                </td>
                <td className="py-3 pr-3 text-slate-500">{branchName(e.branchId) ?? "All branches"}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(e.amount)}</td>
                <td className="py-3">
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="btn-secondary !px-3 !py-1 text-xs !text-red-600">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
