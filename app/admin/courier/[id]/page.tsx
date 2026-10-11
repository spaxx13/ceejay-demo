import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourierRequestById, getLookups, getDeviceModels, getBranches, getActivity, canManageHomeServiceRequests, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { updateCourierRequest } from "@/lib/actions";
import { COURIER_OPTIONS, COURIER_STATUS_LABELS, formatPesos } from "@/lib/courierService";
import { formatDateTime } from "@/lib/format";

function CourierSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <>
      <input name={name} list="courier-options" defaultValue={defaultValue} className="input" placeholder="Courier" />
      <datalist id="courier-options">
        {COURIER_OPTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

export default async function CourierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const { id } = await params;
  const req = await getCourierRequestById(id);
  if (!req) notFound();
  if (isBranchHidden(user, req.branchId)) redirect("/admin/courier");

  const [lookups, deviceModels, branches, activityLog] = await Promise.all([getLookups(), getDeviceModels(), getBranches(), getActivity()]);
  const branch = branches.find((b) => b.id === req.branchId);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const activity = activityLog.filter((a) => a.entityType === "courier_request" && a.entityId === req.id).sort((a, b) => (a.at < b.at ? 1 : -1));
  const total = req.repairCost !== null && req.returnShippingFee !== null ? req.repairCost + req.returnShippingFee : null;
  const open = req.status !== "shipped" && req.status !== "delivered" && req.status !== "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/courier" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to Courier Service
          </Link>
          <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
        </div>
        <StatusBadge label={COURIER_STATUS_LABELS[req.status]} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Request Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-400">Customer</dt>
            <dd className="text-slate-800">{req.name}</dd>
            <dt className="text-slate-400">Phone</dt>
            <dd className="text-slate-800">{req.phone}</dd>
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-800">{req.email || "—"}</dd>
            <dt className="text-slate-400">Ships To</dt>
            <dd className="text-slate-800">{branch?.name ?? "—"}</dd>
            <dt className="text-slate-400">Return Address</dt>
            <dd className="text-slate-800">
              {[req.street, req.barangay, req.city, req.province, req.zipCode].filter(Boolean).join(", ")}
              {req.landmark && <span className="block text-xs text-slate-400">Landmark: {req.landmark}</span>}
            </dd>
            <dt className="text-slate-400">Device</dt>
            <dd className="text-slate-800">{brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "—"}</dd>
            <dt className="text-slate-400">Service Type</dt>
            <dd className="text-slate-800">{serviceType?.label ?? "Not sure yet"}</dd>
            <dt className="text-slate-400">Inbound Shipment</dt>
            <dd className="text-slate-800">{req.inboundTracking ? `${req.inboundCourier} — ${req.inboundTracking}` : "Not provided yet"}</dd>
            <dt className="text-slate-400">Received</dt>
            <dd className="text-slate-800">{req.receivedAt ? formatDateTime(req.receivedAt) : "—"}</dd>
            <dt className="text-slate-400">Booked</dt>
            <dd className="text-slate-800">{formatDateTime(req.createdAt)}</dd>
            <dt className="text-slate-400">Agreement Accepted</dt>
            <dd className="text-slate-800">{req.agreedAt ? formatDateTime(req.agreedAt) : "—"}</dd>
          </dl>
          <div>
            <p className="mb-1 text-sm text-slate-400">Issue</p>
            <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-600">{req.issueDescription}</p>
          </div>
          {req.photoDataUrl && (
            <div>
              <p className="mb-1.5 text-sm text-slate-400">Photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={req.photoDataUrl} alt="Device issue" className="max-h-72 rounded-lg border border-slate-200 object-contain" />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Next Step</h3>

            {req.status === "awaiting_unit" && (
              <form action={updateCourierRequest} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="received" />
                <p className="text-xs text-slate-500">Mark this once the parcel arrives at the branch and you&apos;ve checked it against the customer&apos;s description.</p>
                <button type="submit" className="btn-primary w-full">
                  Mark Received at Branch
                </button>
              </form>
            )}

            {req.status === "received" && (
              <form action={updateCourierRequest}>
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="start_repair" />
                <button type="submit" className="btn-primary w-full">
                  Start Repair
                </button>
              </form>
            )}

            {(req.status === "in_repair" || req.status === "ready_to_ship") && (
              <form action={updateCourierRequest} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="save_amounts" />
                <label className="text-xs font-medium text-slate-500">Repair Cost (₱)</label>
                <input name="repairCost" required inputMode="decimal" defaultValue={req.repairCost ?? ""} className="input" />
                <label className="text-xs font-medium text-slate-500">Return Shipping Fee (₱)</label>
                <input name="returnShippingFee" required inputMode="decimal" defaultValue={req.returnShippingFee ?? ""} className="input" />
                <button type="submit" className="btn-secondary w-full">
                  Save Amounts
                </button>
                <p className="text-[11px] text-slate-400">Saving new amounts clears any recorded payment.</p>
              </form>
            )}

            {req.status === "in_repair" && (
              <form action={updateCourierRequest}>
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="ready" />
                <button type="submit" disabled={total === null} className="btn-primary w-full">
                  Repair Done — Ready to Ship
                </button>
                {total === null && <p className="mt-1 text-[11px] text-slate-400">Save the amounts first.</p>}
              </form>
            )}

            {req.status === "ready_to_ship" && (
              <>
                <p className="text-sm text-slate-700">Customer owes {formatPesos(total)} (InstaPay QR, GCash, or bank transfer).</p>
                {req.paymentProofDataUrl ? (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      Proof uploaded {req.paymentProofAt ? formatDateTime(req.paymentProofAt) : ""}
                      {req.paymentMethod ? ` · ${req.paymentMethod}` : ""}
                      {req.paymentReference ? ` · Ref ${req.paymentReference}` : ""}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={req.paymentProofDataUrl} alt="Proof of payment" className="max-h-64 rounded-lg border border-slate-200 object-contain" />
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Waiting for the customer to upload proof of payment.</p>
                )}
                {req.paidAt ? (
                  <p className="text-xs text-green-700">Payment confirmed {formatDateTime(req.paidAt)}</p>
                ) : (
                  <form action={updateCourierRequest}>
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="intent" value="mark_paid" />
                    <button type="submit" disabled={!req.paymentProofAt} className="btn-secondary w-full">
                      Confirm Payment Received
                    </button>
                  </form>
                )}
                <form action={updateCourierRequest} className="space-y-2 border-t border-slate-200 pt-3">
                  <input type="hidden" name="id" value={req.id} />
                  <input type="hidden" name="intent" value="ship" />
                  <CourierSelect name="outboundCourier" />
                  <input name="outboundTracking" required className="input" placeholder="Tracking / waybill number" />
                  <button type="submit" disabled={!req.paidAt} className="btn-primary w-full">
                    Mark Shipped Back
                  </button>
                  {!req.paidAt && <p className="text-[11px] text-slate-400">Confirm the customer&apos;s payment before shipping.</p>}
                </form>
              </>
            )}

            {req.status === "shipped" && (
              <form action={updateCourierRequest} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="delivered" />
                <p className="text-xs text-slate-500">
                  Shipped via {req.outboundCourier} — {req.outboundTracking}
                </p>
                <button type="submit" className="btn-primary w-full">
                  Mark Delivered
                </button>
              </form>
            )}

            {(req.status === "delivered" || req.status === "cancelled") && <p className="text-sm text-slate-400">Nothing more to do.</p>}
          </div>

          {open && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Inbound Shipment</h3>
              <form action={updateCourierRequest} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="save_inbound" />
                <CourierSelect name="inboundCourier" defaultValue={req.inboundCourier} />
                <input name="inboundTracking" defaultValue={req.inboundTracking} className="input" placeholder="Tracking / waybill number" />
                <button type="submit" className="btn-secondary w-full">
                  Save
                </button>
              </form>
            </div>
          )}

          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Internal Notes</h3>
            <form action={updateCourierRequest} className="space-y-2">
              <input type="hidden" name="id" value={req.id} />
              <input type="hidden" name="intent" value="save_notes" />
              <textarea name="adminNotes" rows={3} defaultValue={req.adminNotes} className="input" />
              <button type="submit" className="btn-secondary w-full">
                Save Notes
              </button>
            </form>
          </div>

          {open && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-red-600">Cancel Request</h3>
              <form action={updateCourierRequest}>
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="cancel" />
                <button type="submit" className="btn-secondary w-full !text-red-600">
                  Cancel This Request
                </button>
              </form>
            </div>
          )}
        </div>
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
  );
}
