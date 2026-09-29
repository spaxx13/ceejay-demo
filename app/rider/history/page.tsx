import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRequests, getRiderById } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

// This rider's own record of every Pickup & Delivery leg they've actually
// completed — /rider ("My Jobs") only ever shows what's currently
// outstanding, so once a pickup or delivery is done it disappears from
// there with nowhere else for the rider to see it. This is that record:
// read-only, most recently completed first, kept entirely separate from
// admin's own Pickup & Delivery views.
export default async function RiderHistoryPage() {
  const user = await getCurrentUser();
  const riderId = user?.riderId ?? null;

  const [allRequests, rider] = await Promise.all([
    riderId ? getRequests() : Promise.resolve([]),
    riderId ? getRiderById(riderId) : Promise.resolve(null),
  ]);

  type Entry = { id: string; reference: string; customerName: string; device: string; role: "Pickup" | "Delivery"; completedAt: string };
  const entries: Entry[] = [];
  for (const r of allRequests) {
    if (r.fulfillmentMode !== "pickup_delivery") continue;
    if (r.pickupRiderId === riderId && r.receivedAtShopAt) {
      entries.push({ id: `${r.id}-pickup`, reference: r.reference, customerName: r.customerName, device: r.deviceOther || "Device not specified", role: "Pickup", completedAt: r.receivedAtShopAt });
    }
    if (r.deliveryRiderId === riderId && r.deliveredAt) {
      entries.push({ id: `${r.id}-delivery`, reference: r.reference, customerName: r.customerName, device: r.deviceOther || "Device not specified", role: "Delivery", completedAt: r.deliveredAt });
    }
  }
  entries.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">My History</h1>
          <p className="text-sm text-slate-400">
            {rider ? `${entries.length} completed leg${entries.length === 1 ? "" : "s"} for ${rider.name}.` : "Completed pickups and deliveries."}
          </p>
        </div>
        <Link href="/rider" className="text-xs text-blue-500 hover:underline">
          &larr; Back to My Jobs
        </Link>
      </div>

      {entries.length === 0 && <p className="card text-center text-sm text-slate-400">No completed pickups or deliveries yet.</p>}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="card space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-400">{e.reference}</span>
              <span
                className={`badge border ${
                  e.role === "Pickup" ? "border-blue-200 bg-blue-50 text-blue-300" : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {e.role}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{e.customerName}</p>
            <p className="text-xs text-slate-500">{e.device}</p>
            <p className="text-[11px] text-slate-400">Completed {formatDateTime(e.completedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
