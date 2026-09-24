import { getRequestByReference, getRiders, getTechnicians, getBranches, getLookups, pickupDeliveryStage, PICKUP_DELIVERY_STAGE_LABELS } from "@/lib/db";
import type { PickupDeliveryStage } from "@/lib/db";
import TrackingLiveMap from "@/components/TrackingLiveMap";

function normalizePhone(p: string) {
  return p.replace(/[\s-]/g, "").replace(/^\+63/, "0");
}

const STAGE_ORDER: PickupDeliveryStage[] = [
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

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ reference?: string; phone?: string }> }) {
  const sp = await searchParams;
  const reference = (sp.reference ?? "").trim();
  const phone = (sp.phone ?? "").trim();

  if (!reference || !phone) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          <div className="text-center">
            <p className="kicker">Pickup &amp; Delivery</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Track Your Request</h1>
            <p className="mt-2 text-sm text-slate-400">Enter your reference number and the mobile number you booked with.</p>
          </div>
          <form className="card space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Reference Number</label>
              <input name="reference" required className="input" placeholder="e.g. CJ-260924-00125" defaultValue={reference} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Mobile Number</label>
              <input name="phone" required className="input" placeholder="09xx xxx xxxx" defaultValue={phone} />
            </div>
            <button type="submit" className="btn-primary w-full">
              Track Request
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [req, riders, technicians, branches, lookups] = await Promise.all([
    getRequestByReference(reference),
    getRiders(),
    getTechnicians(),
    getBranches(),
    getLookups(),
  ]);
  const matches = req && normalizePhone(req.phone) === normalizePhone(phone);

  if (!req || !matches) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <p className="kicker">Pickup &amp; Delivery</p>
          <h1 className="text-2xl font-bold text-slate-900">Not found</h1>
          <p className="text-sm text-slate-400">
            We couldn&apos;t find a request matching that reference number and mobile number. Double-check both and try again.
          </p>
          <a href="/track" className="btn-secondary inline-block">
            Try again
          </a>
        </div>
      </main>
    );
  }

  const statusLabel = lookups.find((l) => l.id === req.statusId)?.label;
  const stage = pickupDeliveryStage(req, statusLabel);

  if (!stage) {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <p className="kicker">{req.reference}</p>
          <h1 className="text-2xl font-bold text-slate-900">On-site Repair</h1>
          <p className="text-sm text-slate-400">
            This request is booked as an on-site visit, not Pickup &amp; Delivery, so it doesn&apos;t use this tracker. Current status:{" "}
            <span className="font-semibold text-slate-700">{statusLabel ?? "—"}</span>. For details, please contact the branch.
          </p>
        </div>
      </main>
    );
  }

  const pickupRider = riders.find((r) => r.id === req.pickupRiderId);
  const deliveryRider = riders.find((r) => r.id === req.deliveryRiderId);
  const technician = technicians.find((t) => t.id === req.assignedTechnicianId);
  const deliveredBranch = branches.find((b) => b.id === req.deliveredBranchId);
  const isLiveStage = stage === "pickup_started" || stage === "picked_up" || stage === "heading_to_shop";
  const customerAddress = [req.street, req.barangay, req.city, req.province].filter(Boolean).join(", ");
  const destinationAddress = stage === "pickup_started" ? customerAddress : stage === "heading_to_shop" ? deliveredBranch?.address : undefined;
  // Exact pin, when one's on file — the customer's own geocoded address
  // (captured at booking time via Places Autocomplete) or the branch's pin
  // set in Admin > Branches. Preferred over the address text on the map.
  const destinationLat = stage === "pickup_started" ? req.lat : stage === "heading_to_shop" ? (deliveredBranch?.lat ?? null) : null;
  const destinationLng = stage === "pickup_started" ? req.lng : stage === "heading_to_shop" ? (deliveredBranch?.lng ?? null) : null;
  const activeRider =
    stage === "out_for_delivery" || stage === "delivery_assigned"
      ? deliveryRider
      : stage === "pickup_assigned" || stage === "pickup_started" || stage === "picked_up" || stage === "heading_to_shop"
        ? pickupRider
        : null;
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <p className="kicker">{req.reference}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Track Your Device</h1>
          <p className="mt-1 text-sm text-slate-400">{req.customerName}</p>
        </div>

        <div className="card space-y-3">
          <p className="text-sm font-semibold text-slate-800">{PICKUP_DELIVERY_STAGE_LABELS[stage]}</p>
          {!isLiveStage && (
            <div className="flex items-center gap-1">
              {STAGE_ORDER.map((s, i) => (
                <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= stageIndex ? "bg-blue-500" : "bg-slate-200"}`} />
              ))}
            </div>
          )}
          {activeRider && !isLiveStage && (
            <p className="text-sm text-slate-600">
              Rider: <span className="font-medium text-slate-800">{activeRider.name}</span>
            </p>
          )}
          {isLiveStage && (
            <TrackingLiveMap
              lat={req.riderLat}
              lng={req.riderLng}
              updatedAt={req.riderLocationUpdatedAt}
              destinationAddress={destinationAddress}
              destinationLat={destinationLat}
              destinationLng={destinationLng}
            />
          )}
          {stage === "picked_up" && <p className="text-sm text-slate-600">Your device is on its way to the shop.</p>}
          {stage === "at_shop" && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-700">
                Delivered{deliveredBranch ? <> to our <span className="font-semibold">{deliveredBranch.name}</span> branch</> : " to the shop"}.
              </p>
              {technician && (
                <p className="text-sm text-slate-600">
                  Technician: <span className="font-medium text-slate-800">{technician.name}</span>
                </p>
              )}
            </div>
          )}
          {stage === "ready_for_delivery" && <p className="text-sm text-slate-600">Repaired and ready — waiting for a delivery rider to be assigned.</p>}
          {stage === "delivered" && <p className="text-sm font-medium text-green-700">Delivered — this request is complete.</p>}
        </div>

        <p className="text-center text-xs text-slate-400">
          {isLiveStage
            ? "This map updates automatically every few seconds."
            : "This page shows the request's current status — refresh anytime for the latest update."}
        </p>
      </div>
    </main>
  );
}
