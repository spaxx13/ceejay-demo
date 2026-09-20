import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMailInRequestById, getLookups, getDeviceModels, getBranches, getActivity, canManageWalkIns, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import PhotoUpload from "@/components/PhotoUpload";
import {
  approveMailInRequest,
  markMailInReceived,
  startMailInRepair,
  completeMailInRepair,
  markMailInPaidManually,
  shipMailInBack,
  markMailInDelivered,
  cancelMailInRequest,
  updateMailInStatus,
} from "@/lib/actions";
import { COURIERS, courierUrl } from "@/lib/couriers";
import { SITE_URL } from "@/lib/config";
import { formatDateTime } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString()}.00`;

function CourierFields() {
  return (
    <>
      <select name="courier" required defaultValue="" className="input">
        <option value="" disabled>
          Select courier
        </option>
        {COURIERS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
        <option value="other">Other</option>
      </select>
      <input name="courierOther" className="input" placeholder="Courier name (only if Other)" />
      <input name="tracking" required className="input" placeholder="Tracking number" />
    </>
  );
}

export default async function MailInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user)) redirect("/admin");

  const { id } = await params;
  const req = await getMailInRequestById(id);
  if (!req) notFound();
  if (isBranchHidden(user, req.branchId)) redirect("/admin/mail-ins");

  const [lookups, deviceModels, branches, activityLog] = await Promise.all([getLookups(), getDeviceModels(), getBranches(), getActivity()]);
  const statuses = lookups.filter((l) => l.kind === "mailin_status").sort((a, b) => a.order - b.order);
  const currentStatus = statuses.find((s) => s.id === req.statusId);
  const label = currentStatus?.label ?? "";
  const branch = branches.find((b) => b.id === req.branchId);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const activity = activityLog.filter((a) => a.entityType === "mailin_request" && a.entityId === req.id).sort((a, b) => (a.at < b.at ? 1 : -1));

  const returnAddress = [req.returnStreet, req.returnBarangay, req.returnCity, req.returnProvince].filter(Boolean).join(", ");
  const paid = req.qrPaymentStatus === "paid";
  const closed = label === "Cancelled" || label === "Delivered";
  const outboundUrl = courierUrl(req.outboundCourier);
  const returnUrl = courierUrl(req.returnCourier);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/mail-ins" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to Repair by Courier
          </Link>
          <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
        </div>
        {currentStatus && <StatusBadge label={currentStatus.label} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Request Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">Customer</dt>
              <dd className="text-slate-800">{req.name}</dd>
              <dt className="text-slate-400">Phone</dt>
              <dd className="text-slate-800">{req.phone}</dd>
              <dt className="text-slate-400">Email</dt>
              <dd className="text-slate-800">{req.email || "—"}</dd>
              <dt className="text-slate-400">Ship-to Branch</dt>
              <dd className="text-slate-800">{branch?.name ?? "—"}</dd>
              <dt className="text-slate-400">Device</dt>
              <dd className="text-slate-800">{brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "—"}</dd>
              <dt className="text-slate-400">Service Type</dt>
              <dd className="text-slate-800">{serviceType?.label ?? "Not sure yet"}</dd>
              <dt className="text-slate-400">Return Address</dt>
              <dd className="text-slate-800">
                {returnAddress || "—"}
                {req.returnLandmark ? ` (near ${req.returnLandmark})` : ""}
              </dd>
              <dt className="text-slate-400">Submitted</dt>
              <dd className="text-slate-800">{formatDateTime(req.createdAt)}</dd>
              <dt className="text-slate-400">Customer Tracking Page</dt>
              <dd className="break-all text-xs text-blue-600">
                <a href={`${SITE_URL}/mail-in/track/${req.token}`} target="_blank" rel="noreferrer">
                  Open
                </a>
              </dd>
            </dl>
            <div>
              <p className="mb-1 text-sm text-slate-400">Issue</p>
              <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-600">{req.issueDescription}</p>
            </div>
            {req.photoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={req.photoDataUrl} alt="Device issue" className="max-h-72 rounded-lg border border-slate-200 object-contain" />
            )}
          </div>

          <div className="card space-y-2 text-sm">
            <h3 className="text-sm font-semibold text-slate-800">Shipping</h3>
            <p className="text-slate-600">
              <span className="text-slate-400">Inbound:</span>{" "}
              {req.outboundTracking ? (
                <>
                  {req.outboundCourier} · <span className="font-mono">{req.outboundTracking}</span>
                  {req.outboundShippedAt ? ` · entered ${formatDateTime(req.outboundShippedAt)}` : ""}
                  {outboundUrl && (
                    <>
                      {" "}
                      <a href={outboundUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                        courier site
                      </a>
                    </>
                  )}
                </>
              ) : (
                "Customer hasn't added a tracking number yet."
              )}
            </p>
            <p className="text-slate-600">
              <span className="text-slate-400">Return:</span>{" "}
              {req.returnTracking ? (
                <>
                  {req.returnCourier} · <span className="font-mono">{req.returnTracking}</span>
                  {req.returnShippedAt ? ` · shipped ${formatDateTime(req.returnShippedAt)}` : ""}
                  {returnUrl && (
                    <>
                      {" "}
                      <a href={returnUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                        courier site
                      </a>
                    </>
                  )}
                </>
              ) : (
                "Not shipped back yet."
              )}
            </p>
          </div>

          {req.receivedAt && (
            <div className="card space-y-2 text-sm">
              <h3 className="text-sm font-semibold text-slate-800">Received</h3>
              <p className="text-slate-500">
                {formatDateTime(req.receivedAt)} by {req.receivedBy || "—"}
              </p>
              {req.receivedConditionNotes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-slate-600">{req.receivedConditionNotes}</p>}
              {req.receivedPhotoDataUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {req.receivedPhotoDataUrls.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`Condition on arrival ${i + 1}`} className="h-28 w-28 rounded-lg border border-slate-200 object-cover" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {label === "Pending Review" && (
            <form action={approveMailInRequest} className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Review this request</h3>
              <input type="hidden" name="id" value={req.id} />
              <textarea
                name="estimateNote"
                rows={3}
                className="input"
                placeholder="Note to the customer, e.g. estimated price (iPhone 13 battery ~₱2,500 + return shipping)"
              />
              <button type="submit" className="btn-primary w-full">
                Approve — Customer Can Ship
              </button>
              <p className="text-[11px] text-slate-400">
                Emails the customer the shipping address. To decline instead, use Cancel request below and give a reason.
              </p>
            </form>
          )}

          {!closed && label !== "Pending Review" && !req.receivedAt && (
            <form action={markMailInReceived} className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Phone arrived? Log it</h3>
              <input type="hidden" name="id" value={req.id} />
              <textarea name="conditionNotes" rows={3} className="input" placeholder="Condition on arrival (scratches, cracks, accessories included...)" />
              <PhotoUpload name="photo1" label="Photo 1 (optional)" />
              <PhotoUpload name="photo2" label="Photo 2 (optional)" />
              <PhotoUpload name="photo3" label="Photo 3 (optional)" />
              <button type="submit" className="btn-primary w-full">
                Mark Received
              </button>
              <p className="text-[11px] text-slate-400">Emails the customer that we got their phone. Please photograph the parcel/phone condition — it protects the shop in disputes.</p>
            </form>
          )}

          {label === "Received" && (
            <form action={startMailInRepair} className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Start repair</h3>
              <input type="hidden" name="id" value={req.id} />
              <textarea name="diagnosis" rows={3} defaultValue={req.diagnosis} className="input" placeholder="Diagnosis / work to be done" />
              <button type="submit" className="btn-primary w-full">
                Mark Repairing
              </button>
            </form>
          )}

          {(label === "Received" || label === "Repairing" || label === "Awaiting Payment") && !paid && (
            <form action={completeMailInRepair} className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{label === "Awaiting Payment" ? "Change final cost" : "Repair done — set final cost"}</h3>
              <input type="hidden" name="id" value={req.id} />
              <input name="finalCost" type="number" min="1" step="0.01" required defaultValue={req.finalCost ?? ""} className="input" placeholder="Final cost (₱)" />
              <textarea name="diagnosis" rows={3} defaultValue={req.diagnosis} className="input" placeholder="What was done (shown to the customer)" />
              <button type="submit" className="btn-primary w-full">
                {label === "Awaiting Payment" ? "Update Cost & Notify Customer" : "Complete & Request Payment"}
              </button>
              <p className="text-[11px] text-slate-400">The customer gets an email with a Pay button (QR Ph). Nothing ships back until it&apos;s paid.</p>
            </form>
          )}

          {label === "Awaiting Payment" && req.finalCost && !paid && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Payment — {peso(req.finalCost)}</h3>
              <p className="text-xs text-slate-500">
                {req.qrPaymentStatus === "pending" ? "Customer started the QR Ph checkout — waiting for payment." : "Waiting for the customer to pay from their tracking page."}
              </p>
              <form action={markMailInPaidManually} className="space-y-2">
                <input type="hidden" name="id" value={req.id} />
                <input name="method" className="input" placeholder="Paid via (e.g. Bank transfer, Cash)" />
                <button type="submit" className="btn-secondary w-full">
                  Mark as Paid (other method)
                </button>
              </form>
            </div>
          )}

          {paid && (
            <div className="card space-y-1 text-sm">
              <h3 className="text-sm font-semibold text-slate-800">Payment</h3>
              <p className="text-green-700">
                ✓ Paid {req.finalCost ? peso(req.finalCost) : ""} via {req.paidMethod || "—"}
              </p>
              {req.paidAt && <p className="text-xs text-slate-400">{formatDateTime(req.paidAt)}</p>}
              {req.repairRecordId && (
                <Link href={`/admin/pos/${req.repairRecordId}`} className="text-xs text-blue-600 hover:underline">
                  View POS record →
                </Link>
              )}
            </div>
          )}

          {paid && !req.returnTracking && !closed && (
            <form action={shipMailInBack} className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Ship back to customer</h3>
              <input type="hidden" name="id" value={req.id} />
              <p className="text-xs text-slate-500">{returnAddress}</p>
              <CourierFields />
              <button type="submit" className="btn-primary w-full">
                Mark Shipped Back
              </button>
            </form>
          )}

          {label === "Shipped Back" && (
            <form action={markMailInDelivered} className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Delivered?</h3>
              <input type="hidden" name="id" value={req.id} />
              <button type="submit" className="btn-primary w-full">
                Mark Delivered
              </button>
            </form>
          )}

          <form action={updateMailInStatus} className="card space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Status (manual override)</h3>
            <input type="hidden" name="id" value={req.id} />
            <select name="statusId" defaultValue={req.statusId} className="input">
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary w-full">
              Update Status
            </button>
          </form>

          {!closed && !paid && (
            <form action={cancelMailInRequest} className="card space-y-2">
              <h3 className="text-sm font-semibold text-red-600">{label === "Pending Review" ? "Decline / cancel request" : "Cancel request"}</h3>
              <input type="hidden" name="id" value={req.id} />
              <input name="reason" className="input" placeholder="Reason (shown to the customer)" />
              <button type="submit" className="btn-secondary w-full !text-red-600">
                Cancel Request
              </button>
            </form>
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
