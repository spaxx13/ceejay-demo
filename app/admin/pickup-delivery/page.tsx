import { redirect } from "next/navigation";
import {
  getRequests,
  getRiders,
  getTechnicians,
  getBranches,
  getLookups,
  getRequestExceptions,
  canManageHomeServiceRequests,
  isBranchHidden,
  pickupDeliveryStage,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import PickupDeliveryBoard from "@/components/PickupDeliveryBoard";
import OpenIssuesList from "@/components/OpenIssuesList";

export default async function PickupDeliveryPage() {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const [allRequests, riders, technicians, branches, lookups, exceptions] = await Promise.all([
    getRequests(),
    getRiders(),
    getTechnicians(),
    getBranches(),
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
      const technician = technicians.find((t) => t.id === r.assignedTechnicianId);
      const pickupRider = riders.find((rd) => rd.id === r.pickupRiderId);
      const deliveryRider = riders.find((rd) => rd.id === r.deliveryRiderId);
      const deliveredBranch = branches.find((b) => b.id === r.deliveredBranchId);
      return {
        id: r.id,
        reference: r.reference,
        customerName: r.customerName,
        street: r.street,
        city: r.city,
        province: r.province,
        deviceOther: r.deviceOther,
        stage: pickupDeliveryStage(r, statusLabel)!,
        statusLabel: statusLabel ?? "—",
        technicianName: technician?.name ?? null,
        pickupRiderId: r.pickupRiderId,
        pickupRiderName: pickupRider?.name ?? null,
        pickupRiderAcceptedAt: r.pickupRiderAcceptedAt,
        deliveryRiderId: r.deliveryRiderId,
        deliveryRiderName: deliveryRider?.name ?? null,
        deliveryRiderAcceptedAt: r.deliveryRiderAcceptedAt,
        pickupStartedAt: r.pickupStartedAt,
        pickedUpAt: r.pickedUpAt,
        headingToShopAt: r.headingToShopAt,
        receivedAtShopAt: r.receivedAtShopAt,
        outForDeliveryAt: r.outForDeliveryAt,
        deliveredAt: r.deliveredAt,
        pickupPhotoDataUrl: r.pickupPhotoDataUrl,
        pickupSecuritySeal: r.pickupSecuritySeal,
        deliveredBranchName: deliveredBranch?.name ?? null,
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const activeRiders = riders.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, onDuty: r.onDuty }));

  // Every open (unresolved) exception across every Pickup & Delivery
  // request this admin can see — including a request that's since been
  // cancelled or is still awaiting payment, unlike `jobs` above which only
  // lists paid, dispatchable ones.
  const pickupDeliveryRequests = allRequests.filter((r) => r.fulfillmentMode === "pickup_delivery" && !isBranchHidden(user, r.queueBranchId));
  const openIssues = exceptions
    .filter((e) => !e.resolvedAt)
    .flatMap((e) => {
      const req = pickupDeliveryRequests.find((r) => r.id === e.requestId);
      return req ? [{ ...e, reference: req.reference, customerName: req.customerName }] : [];
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pickup &amp; Delivery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Requests booked with the Pickup &amp; Delivery fulfillment mode. Assign riders for the pickup and delivery legs here — the repair
          itself still shows up on Home Service Requests and the technician&apos;s own board, same as any other job.
        </p>
      </div>
      <OpenIssuesList issues={openIssues} />
      <PickupDeliveryBoard jobs={jobs} riders={activeRiders} />
    </div>
  );
}
