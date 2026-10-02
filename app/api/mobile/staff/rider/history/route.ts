import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequests } from "@/lib/db";

// The rider's own completed legs, most recent first — a mirror of
// app/rider/history/page.tsx. A pickup counts once the device is received
// at the shop; a delivery once it's delivered.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "rider" || !user.riderId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a rider." }, { status: 401 });
  }
  const riderId = user.riderId;

  const entries: { id: string; reference: string; customerName: string; device: string; role: "Pickup" | "Delivery"; completedAt: string }[] = [];
  for (const r of await getRequests()) {
    if (r.fulfillmentMode !== "pickup_delivery") continue;
    const device = r.deviceOther || "Device not specified";
    if (r.pickupRiderId === riderId && r.receivedAtShopAt) {
      entries.push({ id: `${r.id}-pickup`, reference: r.reference, customerName: r.customerName, device, role: "Pickup", completedAt: r.receivedAtShopAt });
    }
    if (r.deliveryRiderId === riderId && r.deliveredAt) {
      entries.push({ id: `${r.id}-delivery`, reference: r.reference, customerName: r.customerName, device, role: "Delivery", completedAt: r.deliveredAt });
    }
  }
  entries.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));

  return NextResponse.json({ ok: true, entries }, { headers: { "Cache-Control": "no-store" } });
}
