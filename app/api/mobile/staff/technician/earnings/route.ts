import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepairRecords, getServiceAgreements, getTechnicians, getExpenses, getRequests } from "@/lib/db";
import { computeTechnicianEarnings, resolveEarningsRange, type EarningsPeriod, type EarningsJob } from "@/lib/earnings";

// Every numeric field is non-optional on the iOS EarningsJob decoder, so a
// NaN (which JSON serializes to `null`) would fail the whole decode and the
// app would just say it couldn't reach the server. Coerce anything non-finite
// back to 0 before it leaves the route.
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
function sanitizeJob(j: EarningsJob): EarningsJob {
  return {
    ...j,
    repairCost: finite(j.repairCost), serviceFee: finite(j.serviceFee), partsCost: finite(j.partsCost),
    otherExpenses: finite(j.otherExpenses), gross: finite(j.gross), net: finite(j.net), earnings: finite(j.earnings),
  };
}

// The technician earnings view as JSON — a mirror of
// app/technician/earnings/page.tsx: same computeTechnicianEarnings call,
// same two expense buckets (straight-off-the-share business expenses and
// before-the-split net-profit expenses), same period/from/to params.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const [technicians, repairRecords, agreements, expenses, requests] = await Promise.all([
    getTechnicians(),
    getRepairRecords(),
    getServiceAgreements(),
    getExpenses(),
    getRequests(),
  ]);
  const technician = technicians.find((t) => t.id === user.technicianId);
  if (!technician) {
    return NextResponse.json({ ok: false, error: "Your account isn't linked to a Technician record yet." }, { status: 409 });
  }

  const periodParam = sp.get("period");
  const period: EarningsPeriod = periodParam === "week" || periodParam === "month" ? periodParam : "day";
  const { from, to } = resolveEarningsRange(period, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  const jobs = computeTechnicianEarnings(technician.name, repairRecords, agreements, from, to, technician.earningsSharePercent, requests).map(sanitizeJob);
  const businessExpenses = expenses
    .filter((e) => e.target === "technician_final_total_sales" && e.technicianName === technician.name && inRange(e.expenseDate))
    .reduce((s, e) => s + e.amount, 0);
  const netProfitExpenses = expenses
    .filter((e) => e.target === "owner_total_sales" && e.technicianName === technician.name && inRange(e.expenseDate))
    .reduce((s, e) => s + e.amount, 0);

  return NextResponse.json(
    {
      ok: true,
      technicianName: technician.name,
      sharePercent: technician.earningsSharePercent,
      period,
      from,
      to,
      jobs,
      businessExpenses,
      netProfitExpenses,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
