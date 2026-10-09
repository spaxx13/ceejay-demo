import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getRequestById,
  getRequestUpdates,
  getLookups,
  getServiceAgreementsForRequest,
  canManagePickupDelivery,
  pickupDeliveryStage,
} from "@/lib/db";
import { technicianUpdateStatus } from "@/lib/actions";
import RequestUpdateComposer from "@/components/RequestUpdateComposer";
import RequestUpdatesList from "@/components/RequestUpdatesList";
import EditAgreementPriceForm from "@/components/EditAgreementPriceForm";
import { MAX_PRICE_EDITS } from "@/lib/config";

// Technician-side "Repair Updates" for a Pickup & Delivery job at the shop
// — post progress (description + photos/videos) the customer sees on
// /track, and delete their own posts. Linked from the technician board.
export default async function TechnicianUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && !canManagePickupDelivery(user))) redirect("/login");

  const { id } = await params;
  const [req, updates, lookups, agreements] = await Promise.all([
    getRequestById(id),
    getRequestUpdates(id),
    getLookups(),
    getServiceAgreementsForRequest(id),
  ]);
  if (!req || req.fulfillmentMode !== "pickup_delivery") notFound();
  const isAdmin = canManagePickupDelivery(user);
  const deletableIds = updates.filter((u) => isAdmin || u.postedByUserId === user.id).map((u) => u.id);

  // "What's next" — the same steps the technician board offers, in order,
  // so the page doesn't dead-end after an update is posted: start the
  // repair (In Progress) → Pre-Repair checklist → Post-Repair checklist
  // (auto-marks Completed = Ready for Delivery, admin assigns the rider).
  const statuses = lookups.filter((l) => l.kind === "request_status");
  const statusLabel = statuses.find((s) => s.id === req.statusId)?.label;
  const inProgressStatusId = statuses.find((s) => s.label === "In Progress")?.id;
  const stage = pickupDeliveryStage(req, statusLabel);
  const hasPre = agreements.some((a) => a.phase === "pre_repair");
  const hasPost = agreements.some((a) => a.phase === "post_repair");
  const isAssignedTechnician = user.role === "technician" && req.assignedTechnicianId === user.technicianId;
  const inProgress = statusLabel === "In Progress";
  const postAgreement = agreements.find((a) => a.phase === "post_repair");
  // Same rule as the technician board's Update Status: "Pending Confirmation"
  // and "Completed" are never set by hand (Completed happens when the
  // Post-Repair checklist is submitted).
  const technicianStatuses = statuses.filter((s) => (s.label !== "Pending Confirmation" && s.label !== "Completed") || s.id === req.statusId);

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

          {isAssignedTechnician && (
            <div className="card space-y-3">
              <form action={technicianUpdateStatus} className="space-y-1.5">
                <input type="hidden" name="id" value={req.id} />
                <label className="text-xs font-semibold text-slate-700">Repair status</label>
                <select name="statusId" defaultValue={req.statusId} className="input">
                  {technicianStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <textarea name="note" rows={2} className="input" placeholder="Job note (optional)" />
                <button type="submit" className="btn-primary w-full text-sm">
                  Update Status
                </button>
              </form>
              {postAgreement && (
                <div className="space-y-1 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Repair price</p>
                  <EditAgreementPriceForm
                    key={`${postAgreement.cost}-${postAgreement.laborCost}-${postAgreement.partsCost}-${postAgreement.priceEditCount}`}
                    agreementId={postAgreement.id}
                    cost={postAgreement.cost}
                    laborCost={postAgreement.laborCost}
                    partsCost={postAgreement.partsCost}
                    editsRemaining={Math.max(0, MAX_PRICE_EDITS - postAgreement.priceEditCount)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="card space-y-3 border-blue-200 bg-blue-50/40">
            <h2 className="text-sm font-semibold text-slate-800">What&apos;s next?</h2>
            {hasPost || stage === "ready_for_delivery" || stage === "delivery_assigned" || stage === "out_for_delivery" || stage === "delivered" ? (
              <>
                <p className="text-sm font-medium text-green-700">✅ Repair completed — this job is Ready for Delivery.</p>
                <p className="text-xs text-slate-500">
                  {stage === "delivered"
                    ? "The device has been delivered back to the customer."
                    : stage === "out_for_delivery"
                      ? "A rider is on the way to deliver it back to the customer."
                      : stage === "delivery_assigned"
                        ? "A delivery rider has been assigned and will pick it up from the shop."
                        : "The admin will now assign a delivery rider to bring the device back to the customer. Nothing more to do here."}
                </p>
              </>
            ) : !inProgress && !hasPre ? (
              <>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Step 1 of 3 — Start the repair.</span> Marks the job In Progress and opens the
                  Pre-Repair Checklist.
                </p>
                {isAssignedTechnician && inProgressStatusId ? (
                  <form action={technicianUpdateStatus}>
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="statusId" value={inProgressStatusId} />
                    <button type="submit" className="btn-primary w-full text-sm">
                      ▶ Start the Repair (In Progress)
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-amber-700">Only the assigned technician can start the repair.</p>
                )}
              </>
            ) : !hasPre ? (
              <>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Step 2 of 3 — Pre-Repair Checklist.</span> Record the device&apos;s condition as you
                  received it (technician signature only — the customer isn&apos;t at the shop).
                </p>
                <Link href={`/technician/requests/${req.id}/checklist`} className="btn-primary block w-full text-center text-sm">
                  📋 Open Pre-Repair Checklist
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Step 3 of 3 — Post-Repair Checklist.</span> When the repair is done: photo of the
                  device, repair price, and warranty. Submitting it marks the job <span className="font-semibold">Completed → Ready for Delivery</span>,
                  emails the customer their receipt, and tells the admin to assign a delivery rider.
                </p>
                <Link href={`/technician/requests/${req.id}/checklist`} className="btn-primary block w-full text-center text-sm">
                  🔧 Repair done — Open Post-Repair Checklist
                </Link>
              </>
            )}
            <Link href="/technician" className="btn-secondary block w-full text-center text-xs">
              ← Back to My Jobs
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
