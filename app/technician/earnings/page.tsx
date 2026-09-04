import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRepairRecords, getServiceAgreements, getTechnicians } from "@/lib/db";
import { computeTechnicianEarnings, resolveEarningsRange, type EarningsPeriod } from "@/lib/earnings";
import TechnicianEarningsView from "@/components/TechnicianEarningsView";

export default async function TechnicianEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const [user, technicians, repairRecords, agreements] = await Promise.all([
    getCurrentUser(),
    getTechnicians(),
    getRepairRecords(),
    getServiceAgreements(),
  ]);
  const technician = technicians.find((t) => t.id === user?.technicianId);

  const period: EarningsPeriod = sp.period === "week" || sp.period === "month" ? sp.period : "day";
  const isCustomRange = !!(sp.from || sp.to);
  const { from, to } = resolveEarningsRange(period, sp.from, sp.to);
  const jobs = technician
    ? computeTechnicianEarnings(technician.name, repairRecords, agreements, from, to, technician.earningsSharePercent)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">My Earnings</h1>
          <p className="text-sm text-slate-400">Service fee earned on each completed job.</p>
        </div>
        <Link href="/technician" className="text-xs text-blue-500 hover:underline">
          &larr; Back
        </Link>
      </div>

      {!technician ? (
        <div className="card text-center text-sm text-slate-400">Your account isn&apos;t linked to a Technician record yet.</div>
      ) : (
        <TechnicianEarningsView
          baseHref="/technician/earnings"
          technicianName={technician.name}
          sharePercent={technician.earningsSharePercent}
          jobs={jobs}
          period={period}
          from={from}
          to={to}
          isCustomRange={isCustomRange}
        />
      )}
    </div>
  );
}
