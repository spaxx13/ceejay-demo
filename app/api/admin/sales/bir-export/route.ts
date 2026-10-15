import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepairRecords, getServiceAgreements, getRequests, getCourierRequests, getBranches, getTechnicians, grossSalesRecords } from "@/lib/db";
import { todayDateStr } from "@/lib/format";

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Downloadable CSV for Admin > Sales > BIR Records — same data and date
// range as that page, exported as a file for an accountant/bookkeeper
// rather than a BIR-accredited receipt. Owner-only, same as the page.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [repairRecords, agreements, requests, courierRequests, branches, technicians] = await Promise.all([
    getRepairRecords(),
    getServiceAgreements(),
    getRequests(),
    getCourierRequests(),
    getBranches(),
    getTechnicians(),
  ]);

  const today = todayDateStr();
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const from = req.nextUrl.searchParams.get("from") || defaultFrom;
  const to = req.nextUrl.searchParams.get("to") || today;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);

  const records = grossSalesRecords(repairRecords, agreements, requests, courierRequests, branches, technicians, inRange);
  const grossTotal = records.reduce((s, r) => s + r.amount, 0);

  const header = ["Date", "Source", "Reference", "Customer", "Branch", "Device", "Amount"];
  const rows = records.map((r) => [r.date, r.source, r.reference, r.customerName, r.branchName, r.deviceLabel, r.amount.toFixed(2)]);
  const lines = [header, ...rows, [], ["", "", "", "", "", "Total Gross Sales", grossTotal.toFixed(2)]]
    .map((row) => row.map((cell) => csvField(cell)).join(","))
    .join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bir-records-${from}-to-${to}.csv"`,
    },
  });
}
