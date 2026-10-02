import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getRequestById,
  getRiders,
  getTechnicians,
  getBranches,
  getLookups,
  getRequestExceptions,
  getRequestUpdates,
  canManagePickupDelivery,
  isBranchHidden,
  pickupDeliveryStage,
  PICKUP_DELIVERY_STAGE_LABELS,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assignPickupRider, assignDeliveryRider, reassignRequest, reportRequestException, resolveRequestException } from "@/lib/actions";
import { getUnboxingVideoUrl } from "@/lib/storage";
import UnboxingVideoRecorder from "@/components/UnboxingVideoRecorder";
import UnboxingVideoReview from "@/components/UnboxingVideoReview";
import RequestUpdateComposer from "@/components/RequestUpdateComposer";
import RequestUpdatesList from "@/components/RequestUpdatesList";
import { formatDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import JobQrCode from "@/components/JobQrCode";
import ReportExceptionForm from "@/components/ReportExceptionForm";
import { REQUEST_EXCEPTION_LABELS } from "@/lib/types";

// One job's full detail — the same information Admin > Home Service
// Requests puts on its own "View" page, so a Pickup & Delivery job looks
// and works the same way (list page → view → act on it here), instead of
// living inline on a Kanban card.

function RiderAssignForm({
  action,
  requestId,
  riders,
  currentRiderName,
  label,
}: {
  action: (formData: FormData) => void;
  requestId: string;
  riders: { id: string; name: string; onDuty: boolean }[];
  currentRiderName: string | null;
  label: string;
}) {
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <div className="flex gap-1.5">
        <select name="riderId" defaultValue="" required className="input">
          <option value="" disabled>
            {currentRiderName ? `Reassign (currently ${currentRiderName})` : "Select a rider…"}
          </option>
          {[...riders]
            .sort((a, b) => Number(b.onDuty) - Number(a.onDuty))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.onDuty ? "🟢" : "⚪"} {r.name}
                {!r.onDuty ? " (off duty)" : ""}
              </option>
            ))}
        </select>
        <button type="submit" className="btn-primary shrink-0 !px-3">
          {currentRiderName ? "Reassign" : "Assign"}
        </button>
      </div>
    </form>
  );
}

export default async function PickupDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManagePickupDelivery(user)) redirect("/admin");

  const { id } = await params;
  const [req, riders, technicians, branches, lookups, exceptions] = await Promise.all([
    getRequestById(id),
    getRiders(),
    getTechnicians(),
    getBranches(),
    getLookups(),
    getRequestExceptions(),
  ]);
  if (!req || req.fulfillmentMode !== "pickup_delivery" || isBranchHidden(user, req.queueBranchId)) notFound();

  const statuses = lookups.filter((l) => l.kind === "request_status");
  const statusLabel = statuses.find((s) => s.id === req.statusId)?.label;
  const stage = pickupDeliveryStage(req, statusLabel)!;
  const technician = technicians.find((t) => t.id === req.assignedTechnicianId);
  const pickupRider = riders.find((r) => r.id === req.pickupRiderId);
  const deliveryRider = riders.find((r) => r.id === req.deliveryRiderId);
  const deliveredBranch = branches.find((b) => b.id === req.deliveredBranchId);
  const activeRiders = riders.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, onDuty: r.onDuty }));
  // Same branch-scoped technician pool as the Home Service Requests detail
  // page, scoped to wherever this job's device actually ends up (once the
  // rider marks it received at a branch) rather than the original queue —
  // the repair happens at the branch the device is physically at.
  // The branch is the gate: every active technician assigned to the branch
  // the device is at (Admin > Technicians > Branches) is offered. The
  // per-technician "Pickup & Delivery" flag only orders them first — it's
  // a preference, not a requirement, so a branch with none flagged still
  // has someone to assign.
  const repairBranch = deliveredBranch ?? branches.find((b) => b.id === req.queueBranchId) ?? branches.find((b) => !b.address);
  const assignableTechnicians = technicians
    .filter((t) => (t.active && (repairBranch ? t.branchIds.includes(repairBranch.id) : true)) || t.id === req.assignedTechnicianId)
    .sort((a, b) => Number(b.canPickupDelivery) - Number(a.canPickupDelivery) || a.name.localeCompare(b.name));
  const openIssues = exceptions.filter((e) => e.requestId === req.id && !e.resolvedAt);
  const resolvedIssues = exceptions.filter((e) => e.requestId === req.id && e.resolvedAt);
  const unboxingUrl = await getUnboxingVideoUrl(req.unboxingVideoPath);
  const updates = req.receivedAtShopAt ? await getRequestUpdates(req.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/pickup-delivery" className="text-xs text-blue-300 hover:underline">
          ← Back to Pickup &amp; Delivery
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {req.customerName} — {req.deviceOther || "Device"}
            </p>
          </div>
          <StatusBadge label={PICKUP_DELIVERY_STAGE_LABELS[stage]} />
        </div>
      </div>

      {openIssues.length > 0 && (
        <div className="card space-y-2 border-2 border-red-200">
          <h3 className="text-sm font-bold text-red-700">Open Issues ({openIssues.length})</h3>
          {openIssues.map((issue) => (
            <div key={issue.id} className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-red-700">{REQUEST_EXCEPTION_LABELS[issue.kind]}</p>
                <form action={resolveRequestException}>
                  <input type="hidden" name="exceptionId" value={issue.id} />
                  <button type="submit" className="btn-secondary shrink-0 !px-2.5 !py-1 text-xs">
                    Resolve
                  </button>
                </form>
              </div>
              <p className="text-xs text-slate-600">{issue.reason}</p>
              {issue.evidencePhotoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={issue.evidencePhotoDataUrl} alt="Evidence" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
              )}
              <p className="text-[11px] text-slate-400">
                Reported by {issue.reportedBy} ({issue.reportedByRole}) — {formatDateTime(issue.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Customer &amp; Address</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-slate-400">Phone</span>
            <span className="text-right text-slate-600">{req.phone || "—"}</span>
            <span className="text-slate-400">Email</span>
            <span className="text-right text-slate-600">{req.email || "—"}</span>
            <span className="text-slate-400">Address</span>
            <span className="text-right text-slate-600">
              {[req.street, req.barangay, req.city, req.province].filter(Boolean).join(", ") || "—"}
            </span>
            <span className="text-slate-400">Landmark</span>
            <span className="text-right text-slate-600">{req.landmark || "—"}</span>
            <span className="text-slate-400">Preferred Date</span>
            <span className="text-right text-slate-600">{req.preferredDatetime ? formatDateTime(req.preferredDatetime) : "—"}</span>
            <span className="text-slate-400">Distance / Fee</span>
            <span className="text-right text-slate-600">
              {req.pickupDeliveryFeePesos !== null
                ? `${req.pickupDeliveryDistanceKm !== null ? `~${req.pickupDeliveryDistanceKm} km from ${branches.find((b) => b.id === req.pickupDeliveryNearestBranchId)?.name ?? "nearest branch"} → ` : ""}₱${req.pickupDeliveryFeePesos.toLocaleString()}`
                : "—"}
            </span>
            <span className="text-slate-400">P&amp;D Agreement</span>
            <span className={req.pickupDeliveryAgreedAt ? "text-right text-green-700" : "text-right text-amber-700"}>
              {req.pickupDeliveryAgreedAt
                ? `Accepted ${formatDateTime(req.pickupDeliveryAgreedAt)}${req.pickupDeliveryAgreementVersion ? ` (v${req.pickupDeliveryAgreementVersion})` : ""}`
                : "Not recorded"}
            </span>
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Riders &amp; Technician</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-slate-400">Pickup Rider</span>
            <span className="text-right text-slate-600">
              {pickupRider ? pickupRider.name : "—"}
              {pickupRider && !req.pickupRiderAcceptedAt && <span className="ml-1 text-amber-600">(awaiting Accept)</span>}
            </span>
            <span className="text-slate-400">Delivery Rider</span>
            <span className="text-right text-slate-600">
              {deliveryRider ? deliveryRider.name : "—"}
              {deliveryRider && !req.deliveryRiderAcceptedAt && <span className="ml-1 text-amber-600">(awaiting Accept)</span>}
            </span>
            <span className="text-slate-400">Technician</span>
            <span className="text-right text-slate-600">{technician ? technician.name : "Not yet assigned"}</span>
            {req.pickupSecuritySeal && (
              <>
                <span className="text-slate-400">Security Seal</span>
                <span className="text-right font-mono text-slate-600">{req.pickupSecuritySeal}</span>
              </>
            )}
            {deliveredBranch && (
              <>
                <span className="text-slate-400">Destination Branch</span>
                <span className="text-right text-slate-600">{deliveredBranch.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Actions</h3>

        {(stage === "requested" || stage === "pickup_assigned") && (
          <RiderAssignForm
            action={assignPickupRider}
            requestId={req.id}
            riders={activeRiders}
            currentRiderName={pickupRider?.name ?? null}
            label="Pickup rider"
          />
        )}

        {(stage === "ready_for_delivery" || stage === "delivery_assigned") && (
          <RiderAssignForm
            action={assignDeliveryRider}
            requestId={req.id}
            riders={activeRiders}
            currentRiderName={deliveryRider?.name ?? null}
            label="Delivery rider (can differ from pickup)"
          />
        )}

        {req.receivedAtShopAt && (
          <form action={reassignRequest} className="space-y-1.5">
            <input type="hidden" name="id" value={req.id} />
            <label className="text-xs font-semibold text-slate-500">
              Technician (for the repair{repairBranch ? ` at ${repairBranch.name}` : ""})
            </label>
            <div className="flex gap-1.5">
              <select name="technicianId" defaultValue={req.assignedTechnicianId ?? ""} className="input">
                <option value="">Unassigned</option>
                {assignableTechnicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.canPickupDelivery ? " · Pickup & Delivery" : ""}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary shrink-0 !px-3">
                {technician ? "Reassign" : "Assign"}
              </button>
            </div>
            {assignableTechnicians.length === 0 && (
              <p className="text-[11px] text-amber-700">
                No active technicians are assigned to {repairBranch?.name ?? "this branch"} yet — add the branch to a technician in Admin &gt;
                Technicians.
              </p>
            )}
          </form>
        )}

        {req.pickupPhotoDataUrl && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Proof of Pickup</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={req.pickupPhotoDataUrl} alt="Unit picked up" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
          </div>
        )}

        {(stage === "picked_up" || stage === "heading_to_shop" || stage === "at_shop") && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Package Label</p>
            <JobQrCode requestId={req.id} reference={req.reference} />
          </div>
        )}

        {req.receivedAtShopAt && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-500">Unboxing Video</p>
            {unboxingUrl ? (
              <div className="max-w-md">
                <UnboxingVideoReview
                  requestId={req.id}
                  reference={req.reference}
                  videoUrl={unboxingUrl}
                  recordedBy={req.unboxingVideoRecordedBy}
                  recordedAt={req.unboxingVideoRecordedAt}
                  publishedAt={req.unboxingVideoPublishedAt}
                  canDelete
                  canUnpublish
                />
              </div>
            ) : req.unboxingVideoPath ? (
              <p className="text-xs text-amber-700">A video is on file but storage isn&apos;t reachable right now — check SUPABASE_SERVICE_ROLE_KEY.</p>
            ) : (
              <p className="text-xs text-slate-400">Not recorded yet — the technician records it from their board (🎥 Record Unboxing Video), or record it here.</p>
            )}
            <UnboxingVideoRecorder requestId={req.id} existing={!!req.unboxingVideoPath} />
          </div>
        )}

        {req.receivedAtShopAt && (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-500">Repair Updates for the customer ({updates.length})</p>
            <div className="max-w-md">
              <RequestUpdateComposer requestId={req.id} />
            </div>
            <RequestUpdatesList updates={updates} deletableIds={updates.map((u) => u.id)} />
          </div>
        )}

        {stage === "delivered" && req.deliveredAt && (
          <p className="text-sm font-medium text-green-700">Delivered {formatDateTime(req.deliveredAt)}</p>
        )}

        {stage !== "delivered" && (
          <div className="border-t border-slate-200 pt-3">
            <ReportExceptionForm action={reportRequestException} requestId={req.id} role="admin" />
          </div>
        )}
      </div>

      {resolvedIssues.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Resolved Issues ({resolvedIssues.length})</h3>
          {resolvedIssues.map((issue) => (
            <div key={issue.id} className="space-y-0.5 text-xs text-slate-500">
              <p>
                <span className="font-medium text-slate-700">{REQUEST_EXCEPTION_LABELS[issue.kind]}</span> — {issue.reason}
              </p>
              <p className="text-[11px] text-slate-400">
                Reported {formatDateTime(issue.createdAt)} · Resolved by {issue.resolvedBy} {issue.resolvedAt ? formatDateTime(issue.resolvedAt) : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
