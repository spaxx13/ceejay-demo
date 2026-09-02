import { getLookups, getBranches, getExpenses } from "@/lib/db";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import ExpenseManager from "@/components/ExpenseManager";
import { createLookup, toggleLookupActive, updateLookupLabel } from "@/lib/actions";

export default async function ExpensesPage() {
  const [lookups, allBranches, expenses] = await Promise.all([getLookups(), getBranches(), getExpenses()]);
  const categories = lookups.filter((l) => l.kind === "expense_category").sort((a, b) => a.order - b.order);
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, label: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-400">Daily expense recording, grouped by day with per-day totals.</p>
      </div>

      <SimpleLookupTable
        title="Categories"
        items={categories}
        createAction={createLookup}
        hiddenFields={{ kind: "expense_category" }}
        toggleAction={toggleLookupActive}
        updateAction={updateLookupLabel}
        placeholder="Add category..."
      />

      <ExpenseManager
        expenses={expenses}
        branches={branches}
        categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, label: c.label }))}
      />
    </div>
  );
}
