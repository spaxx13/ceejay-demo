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

export type EarningsJob = {
  id: string;
  source: "POS" | "Home Service";
  reference: string;
  customerName: string;
  date: string;
  deviceLabel: string;
  serviceFee: number;
};

// Itemized, completed job orders credited to one technician (matched by
// name — the same identity POS records and service agreements already use
// for technician attribution elsewhere) within [from, to] inclusive.
// "Earnings" here is each job's Labor/Service Cost — what's paid out to the
// technician for their work, distinct from the shop's parts cost or profit.
export function computeTechnicianEarnings(
  technicianName: string,
  repairRecords: RepairRecord[],
  agreements: ServiceAgreement[],
  from: string,
  to: string
): EarningsJob[] {
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const name = technicianName.trim();
  if (!name) return [];

  const posJobs: EarningsJob[] = repairRecords
    .filter((r) => !r.cancelled && r.technicianName.trim() === name && inRange(r.serviceDate))
    .map((r) => ({
      id: r.id,
      source: "POS" as const,
      reference: r.reference,
      customerName: r.customerName,
      date: r.serviceDate,
      deviceLabel: r.deviceModel || "—",
      serviceFee: r.laborCost,
    }));

  const homeServiceJobs: EarningsJob[] = agreements
    .filter((a) => a.phase === "post_repair" && a.requestId && a.technicianName.trim() === name && inRange(a.completedAt.slice(0, 10)))
    .map((a) => ({
      id: a.id,
      source: "Home Service" as const,
      reference: a.reference,
      customerName: a.customerName,
      date: a.completedAt.slice(0, 10),
      deviceLabel: a.deviceLabel || "—",
      serviceFee: a.laborCost,
    }));

  return [...posJobs, ...homeServiceJobs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
