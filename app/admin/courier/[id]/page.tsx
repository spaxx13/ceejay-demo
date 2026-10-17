import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourierRequestById, getLookups, getDeviceModels, getBranches, getActivity, canManageCourier, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { updateCourierRequest, deleteCourierRequest } from "@/lib/actions";
import { COURIER_OPTIONS, SELF_BOOK_COURIER_OPTIONS, courierStatusLabel, formatPesos } from "@/lib/courierService";
import { formatDateTime } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";

function CourierSelect({ name, defaultValue, selfBook }: { name: string; defaultValue?: string; selfBook?: boolean }) {
  return (
    <>
      <input name={name} list="courier-options" defaultValue={defaultValue} className="input" placeholder={selfBook ? "Lalamove / Grab" : "Courier"} />
      <datalist id="courier-options">
        {(selfBook ? SELF_BOOK_COURIER_OPTIONS : COURIER_OPTIONS).map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

export default async function CourierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageCourier(user)) redirect("/admin");

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
  const selfBook = req.deliveryMode === "self_book";
  const open = req.status !== "shipped" && req.status !== "delivered" && req.status !== "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/courier" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to Courier Service
          </Link>
          <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
          {selfBook && <p className="mt-0.5 text-xs font-semibold text-blue-600">Pickup &amp; Delivery — customer books Lalamove / Grab</p>}
        </div>
        <StatusBadge label={courierStatusLabel(req.deliveryMode, req.status)} />
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
            {selfBook && (
              <>
                <dt className="text-slate-400">Hand-over Code</dt>
                <dd className="font-mono text-base font-bold text-slate-900">{req.handoverCode || "—"}</dd>
              </>
            )}
            <dt className="text-slate-400">{selfBook ? "Driver Brings It To" : "Ships To"}</dt>
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
            <dt className="text-slate-400">{selfBook ? "Customer\u2019s Driver (to branch)" : "Inbound Shipment"}</dt>
            <dd className="text-slate-800">{req.inboundTracking ? `${req.inboundCourier} — ${req.inboundTracking}` : "Not provided yet"}</dd>
            {selfBook && (
              <>
                <dt className="text-slate-400">Customer&apos;s Driver (return)</dt>
                <dd className="text-slate-800">{req.outboundTracking ? `${req.outboundCourier} — ${req.outboundTracking}` : "Not booked yet"}</dd>
              </>
            )}
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
                <label className="text-xs font-medium text-slate-500">{selfBook ? "Return Delivery Fee (₱) — enter 0, the customer pays the driver" : "Return Shipping Fee (₱)"}</label>
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
                  {selfBook && (
                    <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                      Customer books their own driver. Release the device only when the driver&apos;s plate number matches below and they can give the hand-over code{" "}
                      <span className="font-mono font-bold">{req.handoverCode}</span>.
                    </p>
                  )}
                  <CourierSelect name="outboundCourier" defaultValue={req.outboundCourier} selfBook={selfBook} />
                  <input
                    name="outboundTracking"
                    required
                    defaultValue={req.outboundTracking}
                    className="input"
                    placeholder={selfBook ? "Booking link / number · Plate no." : "Tracking / waybill number"}
                  />
                  <button type="submit" disabled={!req.paidAt} className="btn-primary w-full">
                    {selfBook ? "Verified — Release to Driver" : "Mark Shipped Back"}
                  </button>
                  {!req.paidAt && <p className="text-[11px] text-slate-400">Confirm the customer&apos;s payment before {selfBook ? "releasing the device" : "shipping"}.</p>}
                </form>
              </>
            )}

            {req.status === "shipped" && (
              <form action={updateCourierRequest} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="intent" value="delivered" />
                <p className="text-xs text-slate-500">
                  {selfBook ? "Released to" : "Shipped via"} {req.outboundCourier} — {req.outboundTracking}
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
                <CourierSelect name="inboundCourier" defaultValue={req.inboundCourier} selfBook={selfBook} />
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

          {user?.role === "owner_admin" && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-red-600">Delete Request</h3>
              <p className="text-xs text-slate-500">
                Moves this request to Trash — it disappears from the list and from the customer&apos;s tracking page, but can be restored later from Trash.
              </p>
              <DeleteButton
                id={req.id}
                action={deleteCourierRequest}
                confirmMessage={`Move courier request ${req.reference} to Trash? You can restore it later from Trash.`}
                label="Move to Trash"
                className="btn-secondary w-full !text-red-600"
              />
            </div>
          )}

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
