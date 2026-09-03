import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getRequestById,
  getLookups,
  getDeviceModels,
  getTechnicians,
  getActivity,
  getCustomFormFields,
  getServiceAgreements,
  getRepairProgressByRequestId,
  canManageHomeServiceRequests,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import ResendReceiptButton from "@/components/ResendReceiptButton";
import { reassignRequest, changeRequestStatus, updateRequestNotes } from "@/lib/actions";
import type { ServiceAgreement } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";

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

  const [lookups, deviceModels, technicians, activityLog, customFormFields, agreements, repairProgress] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getTechnicians(),
    getActivity(),
    getCustomFormFields(),
    getServiceAgreements(),
    getRepairProgressByRequestId(req.id),
  ]);
  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const allTechs = technicians.filter((t) => t.active);
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
            <dt className="text-slate-400">Issue</dt>
            <dd className="text-slate-800">{req.issueDescription}</dd>
            <dt className="text-slate-400">Address</dt>
            <dd className="text-slate-800">
              {req.street}, {req.city}
              {req.province ? `, ${req.province}` : ""}
              {req.landmark ? ` (near ${req.landmark})` : ""}
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
            <p className="text-xs text-slate-400">{req.assignedTechnicianId ? "Manually assigned." : "No technician assigned."}</p>
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
          <p className="text-xs text-slate-500">If the customer asks for another copy, resend the same PDF receipt to their email.</p>
          <ResendReceiptButton target={{ type: "request", id: req.id }} email={req.email} />
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
