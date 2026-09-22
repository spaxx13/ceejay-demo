import { redirect } from "next/navigation";
import { getRequests, getRiders, getTechnicians, getLookups, canManageHomeServiceRequests, isBranchHidden, pickupDeliveryStage } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import PickupDeliveryBoard from "@/components/PickupDeliveryBoard";

export default async function PickupDeliveryPage() {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const [allRequests, riders, technicians, lookups] = await Promise.all([getRequests(), getRiders(), getTechnicians(), getLookups()]);
  const statuses = lookups.filter((l) => l.kind === "request_status");

  const jobs = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && !isBranchHidden(user, r.queueBranchId))
    .map((r) => {
      const statusLabel = statuses.find((s) => s.id === r.statusId)?.label;
      const technician = technicians.find((t) => t.id === r.assignedTechnicianId);
      const pickupRider = riders.find((rd) => rd.id === r.pickupRiderId);
      const deliveryRider = riders.find((rd) => rd.id === r.deliveryRiderId);
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
        deliveryRiderId: r.deliveryRiderId,
        deliveryRiderName: deliveryRider?.name ?? null,
        pickedUpAt: r.pickedUpAt,
        deliveredAt: r.deliveredAt,
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const activeRiders = riders.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pickup &amp; Delivery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Requests booked with the Pickup &amp; Delivery fulfillment mode. Assign riders for the pickup and delivery legs here — the repair
          itself still shows up on Home Service Requests and the technician&apos;s own board, same as any other job.
        </p>
      </div>
      <PickupDeliveryBoard jobs={jobs} riders={activeRiders} />
    </div>
  );
}
