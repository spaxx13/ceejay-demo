import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getRequests,
  getRiders,
  getLookups,
  getRequestExceptions,
  canManageHomeServiceRequests,
  isBranchHidden,
  pickupDeliveryStage,
  PICKUP_DELIVERY_STAGE_LABELS,
  type PickupDeliveryStage,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import BarBreakdownChart from "@/components/BarBreakdownChart";
import OpenIssuesList from "@/components/OpenIssuesList";

// Same list → table → "View" detail-page pattern as Admin > Home Service
// Requests, instead of the old 4-column Kanban board — one consistent
// look across both admin request lists.
export default async function PickupDeliveryPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");
  const sp = await searchParams;

  const [allRequests, riders, lookups, exceptions] = await Promise.all([
    getRequests(),
    getRiders(),
    getLookups(),
    getRequestExceptions(),
  ]);
  const statuses = lookups.filter((l) => l.kind === "request_status");

  const jobs = allRequests
    // Only paid bookings show up here for dispatch — one still awaiting its
    // Booking & Diagnostic Fee isn't a real job yet (see the FINAL FLOW
    // spec: the Job ID/rider assignment step only happens after payment
    // clears). It's still visible to the customer on their own
    // confirm-booking page while they pay.
    .filter(
      (r) =>
        r.fulfillmentMode === "pickup_delivery" &&
        !isBranchHidden(user, r.queueBranchId) &&
        (!r.downpaymentRequired || r.downpaymentStatus === "paid")
    )
    .map((r) => {
      const statusLabel = statuses.find((s) => s.id === r.statusId)?.label;
      const stage = pickupDeliveryStage(r, statusLabel)!;
      const pickupRider = riders.find((rd) => rd.id === r.pickupRiderId);
      const deliveryRider = riders.find((rd) => rd.id === r.deliveryRiderId);
      return {
        id: r.id,
        reference: r.reference,
        customerName: r.customerName,
        deviceOther: r.deviceOther,
        city: r.city,
        province: r.province,
        stage,
        riderName: deliveryRider?.name ?? pickupRider?.name ?? null,
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const jobsByStage = sp.stage ? jobs.filter((j) => j.stage === sp.stage) : jobs;

  const pickupDeliveryRequests = allRequests.filter((r) => r.fulfillmentMode === "pickup_delivery" && !isBranchHidden(user, r.queueBranchId));
  const openIssues = exceptions
    .filter((e) => !e.resolvedAt)
    .flatMap((e) => {
      const req = pickupDeliveryRequests.find((r) => r.id === e.requestId);
      return req ? [{ ...e, reference: req.reference, customerName: req.customerName }] : [];
    });

  const stageOrder: PickupDeliveryStage[] = [
    "requested",
    "pickup_assigned",
    "pickup_started",
    "picked_up",
    "heading_to_shop",
    "at_shop",
    "ready_for_delivery",
    "delivery_assigned",
    "out_for_delivery",
    "delivered",
  ];
  const jobsByStageChart = stageOrder
    .map((s) => ({ label: PICKUP_DELIVERY_STAGE_LABELS[s], value: jobs.filter((j) => j.stage === s).length, stage: s }))
    .filter((s) => s.value > 0);

  function qs(stage: string | undefined) {
    return stage ? `?stage=${encodeURIComponent(stage)}` : "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pickup &amp; Delivery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Requests booked with the Pickup &amp; Delivery fulfillment mode — kept separate from Home Service Requests since these are rider
          jobs, not home visits. Click a job to assign riders, and once the device reaches the shop, assign the technician who&apos;ll do
          the repair right here too.
        </p>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Requests by Stage</h3>
        <BarBreakdownChart data={jobsByStageChart} emptyMessage="No Pickup & Delivery requests yet." />
      </div>

      <OpenIssuesList issues={openIssues} />

      {sp.stage && (
        <div className="card flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {jobsByStage.length} job{jobsByStage.length === 1 ? "" : "s"} — {PICKUP_DELIVERY_STAGE_LABELS[sp.stage as PickupDeliveryStage]}
          </p>
          <Link href="/admin/pickup-delivery" className="text-xs text-blue-300 hover:underline">
            Clear filter
          </Link>
        </div>
      )}

      {/* Mobile: one card per job. */}
      <div className="space-y-3 sm:hidden">
        {jobsByStage.length === 0 && <p className="card text-center text-sm text-slate-400">No jobs match.</p>}
        {jobsByStage.map((j) => (
          <Link key={j.id} href={`/admin/pickup-delivery/${j.id}`} className="card block space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-blue-300">{j.reference}</p>
              <StatusBadge label={PICKUP_DELIVERY_STAGE_LABELS[j.stage]} />
            </div>
            <p className="text-sm font-medium text-slate-800">{j.customerName}</p>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Device</span>
              <span className="text-right text-slate-600">{j.deviceOther || "—"}</span>
              <span className="text-slate-400">Location</span>
              <span className="text-right text-slate-600">{[j.city, j.province].filter(Boolean).join(", ") || "—"}</span>
              <span className="text-slate-400">Rider</span>
              <span className={j.riderName ? "text-right text-slate-600" : "text-right text-amber-700"}>{j.riderName ?? "Unassigned"}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop/tablet: full table, same columns as Home Service Requests. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Device</th>
              <th className="pb-2 pr-3">Location</th>
              <th className="pb-2 pr-3">Rider</th>
              <th className="pb-2 pr-3">Stage</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobsByStage.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No jobs match.
                </td>
              </tr>
            )}
            {jobsByStage.map((j) => (
              <tr key={j.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{j.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{j.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{j.deviceOther || "—"}</td>
                <td className="py-3 pr-3 text-slate-500">{[j.city, j.province].filter(Boolean).join(", ") || "—"}</td>
                <td className="py-3 pr-3 text-slate-500">
                  {j.riderName ?? <span className="text-amber-700">Unassigned</span>}
                </td>
                <td className="py-3 pr-3">
                  <Link href={qs(j.stage)}>
                    <StatusBadge label={PICKUP_DELIVERY_STAGE_LABELS[j.stage]} />
                  </Link>
                </td>
                <td className="py-3">
                  <Link href={`/admin/pickup-delivery/${j.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
