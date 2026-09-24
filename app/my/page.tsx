import Link from "next/link";
import { requireCustomer, logoutCustomer } from "@/lib/customerActions";
import { getRequestsByCustomerId, getLookups, getDeviceModels, pickupDeliveryStage, PICKUP_DELIVERY_STAGE_LABELS } from "@/lib/db";
import { formatDate } from "@/lib/format";

// Stages worth showing a "Track" button for — before pickup_started
// there's no rider position yet to watch, and once delivered there's
// nothing left to track.
const TRACKABLE_PD_STAGES = new Set(["pickup_started", "heading_to_shop", "out_for_delivery"]);

export default async function MyBookingsPage() {
  const customer = await requireCustomer();
  const [requests, lookups, deviceModels] = await Promise.all([getRequestsByCustomerId(customer.id), getLookups(), getDeviceModels()]);

  return (
    <main className="grid-bg min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="kicker">Ceejay Account</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Hi, {customer.name.split(" ")[0] || "there"}</h1>
          </div>
          <form action={logoutCustomer}>
            <button type="submit" className="text-xs text-slate-400 hover:underline">
              Sign Out
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/request" className="card text-center text-sm font-semibold text-slate-700 hover:border-blue-300">
            🚚 Book Home Service
          </Link>
          <Link href="/pickup-delivery" className="card text-center text-sm font-semibold text-slate-700 hover:border-blue-300">
            📦 Pick-up &amp; Delivery
          </Link>
        </div>

        {requests.length === 0 ? (
          <p className="card text-center text-sm text-slate-400">No bookings yet — book a Home Service or Pick-up & Delivery above.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const brand = lookups.find((l) => l.id === r.deviceBrandId);
              const model = deviceModels.find((m) => m.id === r.deviceModelId);
              const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : r.deviceOther || "Device";
              const statusLabel = lookups.find((l) => l.id === r.statusId)?.label ?? "";

              let displayStatus = statusLabel;
              let trackHref: string | null = null;
              if (r.fulfillmentMode === "pickup_delivery") {
                const stage = pickupDeliveryStage(r, statusLabel);
                if (stage) {
                  displayStatus = PICKUP_DELIVERY_STAGE_LABELS[stage];
                  if (TRACKABLE_PD_STAGES.has(stage)) {
                    trackHref = `/track?reference=${encodeURIComponent(r.reference)}&phone=${encodeURIComponent(customer.phone)}`;
                  }
                }
              } else if (r.trackingToken) {
                trackHref = `/track-technician/${r.trackingToken}`;
              }

              return (
                <div key={r.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-slate-400">{r.reference}</p>
                      <p className="font-semibold text-slate-900">{deviceLabel}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{displayStatus}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {r.preferredDatetime ? formatDate(r.preferredDatetime) : "Date to be confirmed"} ·{" "}
                    {r.fulfillmentMode === "pickup_delivery" ? "Pick-up & Delivery" : "Home Service"}
                  </p>
                  {trackHref && (
                    <Link href={trackHref} className="btn-primary block text-center !py-1.5 text-sm">
                      📍 Track Live
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
