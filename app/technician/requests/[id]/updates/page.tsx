import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, getRequestUpdates, canManageHomeServiceRequests } from "@/lib/db";
import RequestUpdateComposer from "@/components/RequestUpdateComposer";
import RequestUpdatesList from "@/components/RequestUpdatesList";

// Technician-side "Repair Updates" for a Pickup & Delivery job at the shop
// — post progress (description + photos/videos) the customer sees on
// /track, and delete their own posts. Linked from the technician board.
export default async function TechnicianUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && !canManageHomeServiceRequests(user))) redirect("/login");

  const { id } = await params;
  const [req, updates] = await Promise.all([getRequestById(id), getRequestUpdates(id)]);
  if (!req || req.fulfillmentMode !== "pickup_delivery") notFound();
  const isAdmin = canManageHomeServiceRequests(user);
  const deletableIds = updates.filter((u) => isAdmin || u.postedByUserId === user.id).map((u) => u.id);

  return (
    <div className="space-y-4">
      <Link href="/technician" className="inline-block text-sm text-slate-400 hover:underline">
        ← Back to My Jobs
      </Link>
      <div>
        <p className="font-mono text-xs text-slate-400">{req.reference}</p>
        <h1 className="text-lg font-bold text-slate-900">Repair Updates</h1>
        <p className="text-sm text-slate-500">
          {req.customerName} — {req.deviceOther || "Device"}
        </p>
      </div>

      {!req.receivedAtShopAt ? (
        <p className="card text-sm text-amber-700">Updates can be posted once the device has been received at the shop.</p>
      ) : (
        <>
          <div className="card">
            <RequestUpdateComposer requestId={req.id} />
          </div>
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-slate-700">Posted updates ({updates.length})</p>
            <RequestUpdatesList updates={updates} deletableIds={deletableIds} />
          </div>
        </>
      )}
    </div>
  );
}
