import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getRequestById,
  getLookups,
  getDeviceModels,
  getTechnicians,
  getBranches,
  getActivity,
  getCustomFormFields,
  getServiceAgreements,
  getRepairProgressByRequestId,
  getRequestsByBookingGroup,
  getServicePrices,
  canManageHomeServiceRequests,
  canDeleteHomeServiceRequests,
  canWaiveServiceFee,
  isBranchHidden,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import ResendReceiptButton from "@/components/ResendReceiptButton";
import DeleteButton from "@/components/DeleteButton";
import Linkify from "@/components/Linkify";
import { reassignRequest, changeRequestStatus, updateRequestNotes, deleteHomeServiceRequest, waiveServiceFee, unwaiveServiceFee } from "@/lib/actions";
import type { ServiceAgreement } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { serviceFeeAmount } from "@/lib/homeServiceFees";
import { getRepairQuote } from "@/lib/servicePricing";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RESULT_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", na: "N/A" };

function AgreementCard({ agreement, title }: { agreement: ServiceAgreement; title: string }) {
  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-400">
          Completed by {agreement.technicianName} on {formatDateTime(agreement.completedAt)}
          {agreement.sentToCustomerAt && " · sent to customer"}
        </p>
      </div>
      <div className="space-y-2">
        {agreement.items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <div>
              <p className="text-sm text-slate-800">{item.label}</p>
              {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
            </div>
            <span className="badge shrink-0 border border-slate-300 bg-slate-100 text-slate-600">
              {RESULT_LABEL[item.result ?? ""] ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {agreement.summaryNotes && (
        <div>
          <p className="text-xs font-medium text-slate-500">Technician Summary</p>
          <p className="whitespace-pre-line text-sm text-slate-600">{agreement.summaryNotes}</p>
        </div>
      )}
      {agreement.phase === "post_repair" && (
        <p className="text-xs text-slate-400">
          {agreement.agreedToTerms ? "✓ Customer agreed to terms and conditions." : "Customer did not agree to terms."}
        </p>
      )}
      <div className={`grid grid-cols-1 gap-4 ${agreement.customerSignatureDataUrl ? "sm:grid-cols-2" : ""}`}>
        {agreement.customerSignatureDataUrl && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Customer Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agreement.customerSignatureDataUrl} alt="Customer signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Technician Signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.technicianSignatureDataUrl ?? ""} alt="Technician signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
        </div>
      </div>
      {agreement.receiptPhotoDataUrl && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Receipt</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.receiptPhotoDataUrl} alt="Receipt" className="max-h-56 rounded-lg border border-slate-200 object-contain" />
        </div>
      )}
    </div>
  );
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const { id } = await params;
  const req = await getRequestById(id);
  if (!req) notFound();
  // Same queue scoping as the list page — a branch admin assigned to only
  // one queue's backend branch can't open the other queue's request even by
  // guessing/bookmarking its URL directly.
  if (isBranchHidden(user, req.queueBranchId)) redirect("/admin/requests");

  const [lookups, deviceModels, technicians, branches, activityLog, customFormFields, agreements, repairProgress, bookingGroup, servicePrices] =
    await Promise.all([
      getLookups(),
      getDeviceModels(),
      getTechnicians(),
      getBranches(),
      getActivity(),
      getCustomFormFields(),
      getServiceAgreements(),
      getRepairProgressByRequestId(req.id),
      req.bookingGroupId ? getRequestsByBookingGroup(req.bookingGroupId) : Promise.resolve([]),
      getServicePrices(),
    ]);
  // Other devices from the same "+ Add Another Device" submission — same
  // visit, same address, one technician assignment cascades across all of
  // them (see reassignRequest()).
  const bookingSiblings = bookingGroup.filter((r) => r.id !== req.id);
  // Same numbers the quotation email showed the customer, recomputed from
  // each request's own stored fields (never persisted) — one repair cost
  // line per device in the booking, plus the single service fee for the
  // shared visit/address.
  const quotationDevices = (req.bookingGroupId ? bookingGroup : [req]).map((r) => {
    const rBrand = lookups.find((l) => l.id === r.deviceBrandId);
    const rModel = deviceModels.find((m) => m.id === r.deviceModelId);
    const rServiceType = lookups.find((l) => l.id === r.serviceTypeId);
    const repairCost = rServiceType?.label ? getRepairQuote(servicePrices, rServiceType.label, r.deviceModelId ?? "", r.screenQuality) : null;
    return {
      id: r.id,
      reference: r.reference,
      deviceLabel: rBrand ? `${rBrand.label} ${rModel?.name ?? ""}`.trim() : r.deviceOther || "Not specified",
      serviceTypeLabel: rServiceType?.label ?? "Service",
      repairCost,
    };
  });
  const quotedServiceFee = serviceFeeAmount(req.province, req.city);
  const effectiveServiceFee = req.serviceFeeWaived ? 0 : quotedServiceFee;
  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  // Home service requests should only ever be assignable to technicians who
  // actually work this request's queue — not every technician in the system
  // (e.g. branch-specific POS technicians, or technicians who only cover the
  // other queue). Falls back to any address-less backend branch for legacy
  // requests submitted before queues existed (no queueBranchId stored). The
  // currently assigned technician (if any) always stays selectable even if
  // they're no longer in that pool, so an existing assignment never
  // silently disappears from the dropdown.
  const homeServiceBranch = branches.find((b) => b.id === req.queueBranchId) ?? branches.find((b) => !b.address);
  const allTechs = technicians.filter(
    (t) =>
      (t.active && (homeServiceBranch ? t.branchIds.includes(homeServiceBranch.id) : true)) || t.id === req.assignedTechnicianId
  );
  const currentStatus = statuses.find((s) => s.id === req.statusId);
  const activity = activityLog
    .filter((a) => a.entityType === "home_service_request" && a.entityId === req.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const customFieldEntries = Object.entries(req.customFields)
    .map(([key, value]) => ({ field: customFormFields.find((f) => f.key === key), value }))
    .filter((e) => e.field);
  const preAgreement = agreements.find((a) => a.requestId === req.id && a.phase === "pre_repair");
  const postAgreement = agreements.find((a) => a.requestId === req.id && a.phase === "post_repair");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/requests" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to requests
          </Link>
          <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
        </div>
        {currentStatus && <StatusBadge label={currentStatus.label} />}
      </div>

      {bookingSiblings.length > 0 && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">
            Part of a {bookingSiblings.length + 1}-device booking — same visit, same address. Assigning a technician here also
            assigns the others below.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {bookingSiblings.map((s) => {
              const siblingStatus = statuses.find((st) => st.id === s.statusId);
              return (
                <Link
                  key={s.id}
                  href={`/admin/requests/${s.id}`}
                  className="rounded-full border border-blue-300 bg-white px-3 py-1 font-mono text-xs text-blue-700 hover:bg-blue-100"
                >
                  {s.reference}
                  {siblingStatus && <span className="ml-1.5 text-blue-500">({siblingStatus.label})</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Quotation</h3>
        <p className="text-xs text-slate-500">The same quotation that was emailed to the customer.</p>
        <div className="space-y-2">
          {quotationDevices.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0 text-sm">
              <div>
                <p className="text-slate-800">
                  {d.deviceLabel} — {d.serviceTypeLabel}
                </p>
                <p className="font-mono text-xs text-slate-400">{d.reference}</p>
              </div>
              <span className="shrink-0 text-slate-800">{d.repairCost !== null ? peso(d.repairCost) : "Confirmed upon inspection"}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1 text-sm">
            <p className="text-slate-500">Service Fee (one visit)</p>
            <span className="text-slate-800">
              {req.serviceFeeWaived ? (
                <>
                  {quotedServiceFee !== null && <span className="mr-1.5 text-slate-400 line-through">{peso(quotedServiceFee)}</span>}
                  <span className="font-medium text-green-700">Waived</span>
                </>
              ) : quotedServiceFee !== null ? (
                peso(quotedServiceFee)
              ) : (
                "—"
              )}
            </span>
          </div>
          {effectiveServiceFee !== null && quotationDevices.every((d) => d.repairCost !== null) && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-semibold">
              <p className="text-slate-700">Total</p>
              <span className="text-slate-900">
                {peso(quotationDevices.reduce((sum, d) => sum + (d.repairCost ?? 0), 0) + effectiveServiceFee)}
              </span>
            </div>
          )}
          {canWaiveServiceFee(user) && quotedServiceFee !== null && (
            <div className="border-t border-slate-100 pt-2">
              {req.serviceFeeWaived ? (
                <DeleteButton
                  id={req.id}
                  action={unwaiveServiceFee}
                  confirmMessage={`Restore the ${peso(quotedServiceFee)} service fee for ${req.reference}? The customer will be expected to pay it again.`}
                  label="Restore Service Fee"
                  className="btn-secondary !px-3 !py-1 text-xs"
                />
              ) : (
                <DeleteButton
                  id={req.id}
                  action={waiveServiceFee}
                  confirmMessage={`Waive the ${peso(quotedServiceFee)} service fee for ${req.reference}? The customer won't be charged for this visit.`}
                  label="Waive Service Fee"
                  className="btn-secondary !px-3 !py-1 text-xs !text-amber-700"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Request Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-400">Customer</dt>
            <dd className="text-slate-800">{req.customerName}</dd>
            <dt className="text-slate-400">Phone</dt>
            <dd className="text-slate-800">{req.phone}</dd>
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-800">{req.email || "—"}</dd>
            <dt className="text-slate-400">Device</dt>
            <dd className="text-slate-800">{brand ? `${brand.label} ${model?.name ?? ""}` : req.deviceOther || "—"}</dd>
            <dt className="text-slate-400">Service Type</dt>
            <dd className="text-slate-800">{serviceType?.label ?? "—"}</dd>
            {req.screenQuality && (
              <>
                <dt className="text-slate-400">Screen Quality</dt>
                <dd className="text-slate-800">{req.screenQuality === "original" ? "Original" : "High Quality (compatible)"}</dd>
              </>
            )}
            {req.backHousingColor && (
              <>
                <dt className="text-slate-400">Back Housing Color</dt>
                <dd className="text-slate-800">{req.backHousingColor}</dd>
              </>
            )}
            <dt className="text-slate-400">Issue</dt>
            <dd className="text-slate-800">{req.issueDescription}</dd>
            <dt className="text-slate-400">Address</dt>
            <dd className="text-slate-800">
              <Linkify
                text={`${req.street}${req.barangay ? `, Brgy. ${req.barangay}` : ""}, ${req.city}${req.province ? `, ${req.province}` : ""}${req.landmark ? ` (near ${req.landmark})` : ""}`}
              />
            </dd>
            <dt className="text-slate-400">Preferred</dt>
            <dd className="text-slate-800">{formatDate(req.preferredDatetime)}</dd>
            <dt className="text-slate-400">Vlog Consent</dt>
            <dd className="text-slate-800">
              {req.vlogConsent
                ? `Yes — ${req.vlogBlurPreference === "blurred" ? "face blurred" : req.vlogBlurPreference === "not_blurred" ? "face not blurred" : "preference not set"}`
                : "No"}
            </dd>
            <dt className="text-slate-400">Submitted</dt>
            <dd className="text-slate-800">{formatDateTime(req.createdAt)}</dd>
          </dl>
          {req.photoDataUrl && (
            <div>
              <p className="mb-1.5 text-sm text-slate-400">Photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={req.photoDataUrl} alt="Device issue" className="max-h-72 rounded-lg border border-slate-200 object-contain" />
            </div>
          )}
          {customFieldEntries.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <p className="mb-1.5 text-sm text-slate-400">Additional Details</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {customFieldEntries.map(({ field, value }) => (
                  <div key={field!.id} className="contents">
                    <dt className="text-slate-400">{field!.label}</dt>
                    <dd className="text-slate-800">{typeof value === "boolean" ? (value ? "Yes" : "No") : value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Assignment</h3>
            <p className="text-xs text-slate-400">
              {req.assignedTechnicianId ? (req.autoAssigned ? "Auto-assigned." : "Manually assigned.") : "No technician assigned."}
            </p>
            <form action={reassignRequest} className="space-y-2">
              <input type="hidden" name="id" value={req.id} />
              <select name="technicianId" defaultValue={req.assignedTechnicianId ?? ""} className="input">
                <option value="">Unassigned</option>
                {allTechs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-full">
                Save Assignment
              </button>
            </form>
          </div>

          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Status</h3>
            <form action={changeRequestStatus} className="space-y-2">
              <input type="hidden" name="id" value={req.id} />
              <select name="statusId" defaultValue={req.statusId} className="input">
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-full">
                Update Status
              </button>
            </form>
          </div>

          {canDeleteHomeServiceRequests(user) && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-red-600">Delete Request</h3>
              <p className="text-xs text-slate-500">
                Moves this request to Trash — it disappears from the normal list but can still be restored later from Trash, or deleted
                permanently from there.
              </p>
              <DeleteButton
                id={req.id}
                action={deleteHomeServiceRequest}
                confirmMessage={`Move home service request ${req.reference} to Trash? You can restore it later from Trash.`}
                label="Move to Trash"
                className="btn-secondary w-full !text-red-600"
              />
            </div>
          )}
        </div>
      </div>

      {repairProgress && (repairProgress.inspectionResults || repairProgress.progressNotes || repairProgress.partsReplaced || repairProgress.otherDetails) && (
        <div className="card space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Repair Progress Notes</h3>
            <p className="text-xs text-slate-400">Last updated by {repairProgress.updatedBy || "—"} on {formatDateTime(repairProgress.updatedAt)}</p>
          </div>
          {repairProgress.inspectionResults && (
            <div>
              <p className="text-xs font-medium text-slate-400">Inspection Results</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{repairProgress.inspectionResults}</p>
            </div>
          )}
          {repairProgress.progressNotes && (
            <div>
              <p className="text-xs font-medium text-slate-400">Repair Progress</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{repairProgress.progressNotes}</p>
            </div>
          )}
          {repairProgress.partsReplaced && (
            <div>
              <p className="text-xs font-medium text-slate-400">Parts Replaced</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{repairProgress.partsReplaced}</p>
            </div>
          )}
          {repairProgress.otherDetails && (
            <div>
              <p className="text-xs font-medium text-slate-400">Other Details</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{repairProgress.otherDetails}</p>
            </div>
          )}
        </div>
      )}

      {preAgreement && <AgreementCard agreement={preAgreement} title={`Pre-Repair Checklist — ${preAgreement.reference}`} />}
      {postAgreement && <AgreementCard agreement={postAgreement} title={`Post-Repair Checklist / Service Agreement — ${postAgreement.reference}`} />}

      {postAgreement && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Receipt</h3>
          <p className="text-xs text-slate-500">The same PDF receipt that was emailed to the customer.</p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/receipt?requestId=${req.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              View Receipt
            </a>
            <ResendReceiptButton target={{ type: "request", id: req.id }} email={req.email} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Admin Notes</h3>
          <form action={updateRequestNotes} className="space-y-2">
            <input type="hidden" name="id" value={req.id} />
            <textarea name="adminNotes" defaultValue={req.adminNotes} rows={5} className="input" placeholder="Internal notes..." />
            <button type="submit" className="btn-secondary">
              Save Notes
            </button>
          </form>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Activity Log</h3>
          <ul className="space-y-2 text-sm">
            {activity.length === 0 && <li className="text-slate-400">No activity yet.</li>}
            {activity.map((a) => (
              <li key={a.id} className="border-b border-slate-200 pb-2 last:border-0">
                <p className="text-slate-700">{a.message}</p>
                <p className="text-[11px] text-slate-400">{formatDateTime(a.at)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
