import { getCurrentUser } from "@/lib/auth";
import { getRequests, getBranches } from "@/lib/db";
import { riderUpdatePickupStatus, riderUpdateDeliveryStatus, riderUpdateDestinationBranch } from "@/lib/actions";
import RiderStatusUpdateForm from "@/components/RiderStatusUpdateForm";
import RiderLocationReporter from "@/components/RiderLocationReporter";
import RiderBranchRedirectForm from "@/components/RiderBranchRedirectForm";

const PICKUP_STATUS_OPTIONS = [
  { value: "on_the_way", label: "On The Way" },
  { value: "picked_up", label: "Picked Up", needsSignature: true, needsPhoto: true },
  { value: "heading_to_shop", label: "On The Way to Branch", needsBranch: true },
  { value: "delivered_to_branch", label: "Delivered to Branch", needsBranch: true },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: "on_the_way", label: "On The Way" },
  { value: "delivered", label: "Mark Delivered", needsSignature: true },
];

export default async function RiderPage() {
  const user = await getCurrentUser();
  const riderId = user?.riderId ?? null;

  const [allRequests, allBranches] = await Promise.all([riderId ? getRequests() : Promise.resolve([]), getBranches()]);
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));
  // The pickup leg isn't done until the device is actually at the shop, not
  // just once it leaves the customer's hands.
  const myPickups = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.pickupRiderId === riderId && !r.receivedAtShopAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const myDeliveries = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.deliveryRiderId === riderId && !r.deliveredAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">My Jobs</h1>
        <p className="text-sm text-slate-400">
          {myPickups.length} pickup{myPickups.length === 1 ? "" : "s"}, {myDeliveries.length} deliver{myDeliveries.length === 1 ? "y" : "ies"} waiting on you.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Pickups ({myPickups.length})</h2>
        {myPickups.length === 0 && <p className="card text-center text-sm text-slate-400">No pickups assigned to you right now.</p>}
        {myPickups.map((r) => {
          const defaultStatus = r.headingToShopAt
            ? "delivered_to_branch"
            : r.pickedUpAt
              ? "heading_to_shop"
              : r.pickupStartedAt
                ? "picked_up"
                : "on_the_way";
          return (
            <div key={r.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{r.reference}</span>
                <span className="badge border border-blue-200 bg-blue-50 text-blue-300">
                  {r.headingToShopAt
                    ? "Heading to branch"
                    : r.pickedUpAt
                      ? "Has device"
                      : r.pickupStartedAt
                        ? "On the way"
                        : "Pickup"}
                </span>
              </div>
              <p className="text-base font-semibold text-slate-900">{r.customerName}</p>
              <p className="text-sm text-slate-600">
                {r.street}, {r.barangay ? `${r.barangay}, ` : ""}
                {r.city}
                {r.province ? `, ${r.province}` : ""}
              </p>
              {r.landmark && <p className="text-xs text-slate-400">Landmark: {r.landmark}</p>}
              <p className="text-sm text-slate-600">{r.deviceOther || "Device not specified"}</p>
              {r.phone && (
                <a href={`tel:${r.phone}`} className="btn-secondary inline-block !px-3 !py-1.5 text-xs">
                  Call {r.phone}
                </a>
              )}
              {r.pickupStartedAt && !r.receivedAtShopAt && <RiderLocationReporter requestId={r.id} />}
              {r.headingToShopAt && !r.receivedAtShopAt && (
                <RiderBranchRedirectForm
                  action={riderUpdateDestinationBranch}
                  requestId={r.id}
                  branches={branches}
                  currentBranchId={r.deliveredBranchId}
                />
              )}
              <RiderStatusUpdateForm
                action={riderUpdatePickupStatus}
                requestId={r.id}
                options={PICKUP_STATUS_OPTIONS}
                defaultValue={defaultStatus}
                branches={branches}
                defaultBranchId={r.deliveredBranchId ?? undefined}
              />
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Deliveries ({myDeliveries.length})</h2>
        {myDeliveries.length === 0 && <p className="card text-center text-sm text-slate-400">No deliveries assigned to you right now.</p>}
        {myDeliveries.map((r) => {
          const defaultStatus = r.outForDeliveryAt ? "delivered" : "on_the_way";
          return (
            <div key={r.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{r.reference}</span>
                <span className="badge border border-green-200 bg-green-50 text-green-700">{r.outForDeliveryAt ? "On the way" : "Delivery"}</span>
              </div>
              <p className="text-base font-semibold text-slate-900">{r.customerName}</p>
              <p className="text-sm text-slate-600">
                {r.street}, {r.barangay ? `${r.barangay}, ` : ""}
                {r.city}
                {r.province ? `, ${r.province}` : ""}
              </p>
              {r.landmark && <p className="text-xs text-slate-400">Landmark: {r.landmark}</p>}
              <p className="text-sm text-slate-600">{r.deviceOther || "Device not specified"} — repaired, ready for delivery</p>
              {r.phone && (
                <a href={`tel:${r.phone}`} className="btn-secondary inline-block !px-3 !py-1.5 text-xs">
                  Call {r.phone}
                </a>
              )}
              <RiderStatusUpdateForm action={riderUpdateDeliveryStatus} requestId={r.id} options={DELIVERY_STATUS_OPTIONS} defaultValue={defaultStatus} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
