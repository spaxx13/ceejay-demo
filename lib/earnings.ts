import type { RepairRecord, ServiceAgreement } from "./types";

export type EarningsPeriod = "day" | "week" | "month";

// Resolves a named period (day/week/month, anchored on `today`) to an
// inclusive [from, to] date range (YYYY-MM-DD), or passes an explicit
// custom range straight through when one is given.
export function resolveEarningsRange(period: EarningsPeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
  if (customFrom || customTo) return { from: customFrom || customTo!, to: customTo || customFrom! };

  const now = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  if (period === "day") {
    const today = toISO(now);
    return { from: today, to: today };
  }
  if (period === "week") {
    // Monday-start week containing today.
    const day = now.getDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toISO(monday), to: toISO(sunday) };
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISO(first), to: toISO(last) };
}

// Fallback technician's cut of each job's net when a technician has no
// earningsSharePercent of their own — kept as the shop-wide default. Prefer
// passing each technician's own share (from their Technician record, via
// lib/db.ts's technicianSharePercent) into computeTechnicianEarnings below.
export const DEFAULT_EARNINGS_SHARE_PERCENT = 50;

export type EarningsJob = {
  id: string;
  source: "POS" | "Home Service";
  reference: string;
  customerName: string;
  date: string;
  deviceLabel: string;
  repairCost: number;
  serviceFee: number;
  partsCost: number;
  otherExpenses: number;
  gross: number; // repairCost + serviceFee — total job value, informational
  net: number; // what this job actually contributes to Net Profit — the split base
  earnings: number; // net * (sharePercent / 100) — what the technician is paid for this job
};

// Exported so any other view (e.g. the aggregate By Technician table) can
// compute the exact same breakdown per record instead of re-deriving its
// own formula — that drift is exactly what caused pages to disagree before
// this was factored out.
//
// POS and Home Service bill the customer differently, so Net is computed
// differently per source — mirroring whichever report already owns that
// job type, so this never disagrees with it:
//   POS (source="POS"): the service fee is an internal cost paid out, not
//   billed to the customer on top of the repair price — same as Branch
//   Sales, where revenue is the repair price alone and Parts/Service/Other
//   are all deducted from it.
//     Net = Repair Cost − Parts Cost − Service Fee − Other Expenses
//   Home Service (source="Home Service"): the service fee IS billed to the
//   customer on top of the repair price (the customer-facing Total Amount)
//   — same as Home Service Sales, which only deducts Parts/Material Cost
//   from that Total Amount.
//     Net = (Repair Cost + Service Fee) − Parts Cost
export function toJob(
  id: string,
  source: EarningsJob["source"],
  reference: string,
  customerName: string,
  date: string,
  deviceLabel: string,
  repairCost: number,
  serviceFee: number,
  partsCost: number,
  otherExpenses: number,
  sharePercent: number
): EarningsJob {
  const gross = repairCost + serviceFee;
  const net = source === "POS" ? repairCost - partsCost - serviceFee - otherExpenses : gross - partsCost;
  return {
    id, source, reference, customerName, date, deviceLabel, repairCost, serviceFee, partsCost, otherExpenses,
    gross, net, earnings: net * (sharePercent / 100),
  };
}

// Itemized, completed job orders credited to one technician (matched by
// name — the same identity POS records and service agreements already use
// for technician attribution elsewhere) within [from, to] inclusive.
export function computeTechnicianEarnings(
  technicianName: string,
  repairRecords: RepairRecord[],
  agreements: ServiceAgreement[],
  from: string,
  to: string,
  sharePercent: number = DEFAULT_EARNINGS_SHARE_PERCENT
): EarningsJob[] {
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const name = technicianName.trim();
  if (!name) return [];

  const posJobs = repairRecords
    .filter((r) => !r.cancelled && r.technicianName.trim() === name && inRange(r.serviceDate))
    .map((r) =>
      toJob(r.id, "POS", r.reference, r.customerName, r.serviceDate, r.deviceModel || "—", r.cost, r.laborCost, r.partsCost, r.otherExpenses, sharePercent)
    );

  const homeServiceJobs = agreements
    .filter((a) => a.phase === "post_repair" && a.requestId && a.technicianName.trim() === name && inRange(a.completedAt.slice(0, 10)))
    .map((a) =>
      toJob(
        a.id, "Home Service", a.reference, a.customerName, a.completedAt.slice(0, 10), a.deviceLabel || "—",
        a.cost, a.laborCost, a.partsCost, a.otherExpenses, sharePercent
      )
    );

  return [...posJobs, ...homeServiceJobs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
