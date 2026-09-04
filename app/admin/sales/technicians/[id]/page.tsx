import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepairRecords, getServiceAgreements, getTechnicians, getExpenses, isBranchHidden, homeServiceBranchId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeTechnicianEarnings, resolveEarningsRange, type EarningsPeriod } from "@/lib/earnings";
import SalesTabs from "@/components/SalesTabs";
import TechnicianEarningsView from "@/components/TechnicianEarningsView";

export default async function TechnicianEarningsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [user, technicians, allRepairRecords, allAgreements, allExpenses] = await Promise.all([
    getCurrentUser(),
    getTechnicians(),
    getRepairRecords(),
    getServiceAgreements(),
    getExpenses(),
  ]);
  const technician = technicians.find((t) => t.id === id);
  if (!technician) notFound();

  // Same branch scoping as the rest of Sales — a branch-scoped branch admin
  // only sees this technician's jobs at branches they're allowed to see.
  const repairRecords = allRepairRecords.filter((r) => !isBranchHidden(user, r.branchId));
  const agreements = allAgreements.filter(
    (a) => !isBranchHidden(user, a.requestId ? homeServiceBranchId(a.technicianId, a.branchId, technicians) : a.branchId)
  );
  const expenses = allExpenses.filter((e) => !isBranchHidden(user, e.branchId));

  const period: EarningsPeriod = sp.period === "week" || sp.period === "month" ? sp.period : "day";
  const isCustomRange = !!(sp.from || sp.to);
  const { from, to } = resolveEarningsRange(period, sp.from, sp.to);
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const jobs = computeTechnicianEarnings(technician.name, repairRecords, agreements, from, to, technician.earningsSharePercent);
  const businessExpenses = expenses
    .filter((e) => e.target === "technician_final_total_sales" && e.technicianName === technician.name && inRange(e.expenseDate))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{technician.name} — Earnings</h1>
          <p className="mt-1 text-sm text-slate-400">Itemized completed job orders and the service fee earned on each.</p>
        </div>
        <Link href="/admin/sales/technicians" className="text-xs text-blue-500 hover:underline">
          &larr; Back to By Technician
        </Link>
      </div>

      <SalesTabs />

      <TechnicianEarningsView
        baseHref={`/admin/sales/technicians/${technician.id}`}
        technicianName={technician.name}
        sharePercent={technician.earningsSharePercent}
        jobs={jobs}
        businessExpenses={businessExpenses}
        period={period}
        from={from}
        to={to}
        isCustomRange={isCustomRange}
      />
    </div>
  );
}
