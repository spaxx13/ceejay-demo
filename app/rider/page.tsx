import { getCurrentUser } from "@/lib/auth";
import { getRequests } from "@/lib/db";
import { riderMarkPickupStarted, riderMarkPickedUp, riderMarkReceivedAtShop, riderMarkOutForDelivery, riderMarkDelivered } from "@/lib/actions";
import SignaturePad from "@/components/SignaturePad";

export default async function RiderPage() {
  const user = await getCurrentUser();
  const riderId = user?.riderId ?? null;

  const allRequests = riderId ? await getRequests() : [];
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
        {myPickups.map((r) => (
          <div key={r.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400">{r.reference}</span>
              <span className="badge border border-blue-200 bg-blue-50 text-blue-300">
                {r.pickedUpAt ? "Has device — heading to shop" : r.pickupStartedAt ? "On the way" : "Pickup"}
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

            {!r.pickupStartedAt && (
              <form action={riderMarkPickupStarted} className="border-t border-slate-200 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <button type="submit" className="btn-primary w-full">
                  On The Way
                </button>
              </form>
            )}

            {r.pickupStartedAt && !r.pickedUpAt && (
              <form action={riderMarkPickedUp} className="space-y-3 border-t border-slate-200 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <SignaturePad name="signatureDataUrl" label="Customer Signature (optional)" />
                <button type="submit" className="btn-primary w-full">
                  Mark Picked Up
                </button>
              </form>
            )}

            {r.pickedUpAt && (
              <form action={riderMarkReceivedAtShop} className="border-t border-slate-200 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <button type="submit" className="btn-primary w-full">
                  Delivered to Branch
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Deliveries ({myDeliveries.length})</h2>
        {myDeliveries.length === 0 && <p className="card text-center text-sm text-slate-400">No deliveries assigned to you right now.</p>}
        {myDeliveries.map((r) => (
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

            {!r.outForDeliveryAt && (
              <form action={riderMarkOutForDelivery} className="border-t border-slate-200 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <button type="submit" className="btn-primary w-full">
                  On The Way
                </button>
              </form>
            )}

            {r.outForDeliveryAt && (
              <form action={riderMarkDelivered} className="space-y-3 border-t border-slate-200 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <SignaturePad name="signatureDataUrl" label="Customer Signature (optional)" />
                <button type="submit" className="btn-primary w-full">
                  Mark Delivered
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
