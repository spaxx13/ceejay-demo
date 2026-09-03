import { redirect } from "next/navigation";
import { getExpenses, getBranches, isBranchHidden } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";
import ExpenseManager from "@/components/ExpenseManager";

export default async function ExpensesPage() {
  const actor = await requireRole("owner_admin", "branch_admin");
  if (!actor) redirect("/admin/sales");

  const [user, allExpenses, allBranches] = await Promise.all([getCurrentUser(), getExpenses(), getBranches()]);
  const branches = allBranches.filter((b) => b.active && !isBranchHidden(user, b.id)).map((b) => ({ id: b.id, name: b.name }));
  const expenses = allExpenses.filter((e) => !isBranchHidden(user, e.branchId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-400">
          Business expenses (rent, utilities, tools, etc.) that get deducted from the owner&apos;s or a technician&apos;s totals on the Sales
          reports.
        </p>
      </div>

      <SalesTabs />

      <ExpenseManager expenses={expenses} branches={branches} />
    </div>
  );
}
