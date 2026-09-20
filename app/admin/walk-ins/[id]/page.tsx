import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWalkInRequestById, getLookups, getDeviceModels, getBranches, getActivity, canManageWalkIns, canDeleteHomeServiceRequests, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import { updateWalkInStatus, deleteWalkInRequest } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/format";

export default async function WalkInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user)) redirect("/admin");

  const { id } = await params;
  const req = await getWalkInRequestById(id);
  if (!req) notFound();
  if (isBranchHidden(user, req.branchId)) redirect("/admin/walk-ins");

  const [lookups, deviceModels, branches, activityLog] = await Promise.all([getLookups(), getDeviceModels(), getBranches(), getActivity()]);
  const statuses = lookups.filter((l) => l.kind === "walkin_status").sort((a, b) => a.order - b.order);
  const currentStatus = statuses.find((s) => s.id === req.statusId);
  const branch = branches.find((b) => b.id === req.branchId);
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const activity = activityLog.filter((a) => a.entityType === "walkin_request" && a.entityId === req.id).sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/walk-ins" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to Walk-In Registrations
          </Link>
          <h1 className="mt-1 font-mono text-lg font-bold text-slate-900">{req.reference}</h1>
        </div>
        {currentStatus && <StatusBadge label={currentStatus.label} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Registration Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-400">Customer</dt>
            <dd className="text-slate-800">{req.name}</dd>
            <dt className="text-slate-400">Phone</dt>
            <dd className="text-slate-800">{req.phone}</dd>
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-800">{req.email || "—"}</dd>
            <dt className="text-slate-400">Branch</dt>
            <dd className="text-slate-800">{branch?.name ?? "—"}</dd>
            <dt className="text-slate-400">Device</dt>
            <dd className="text-slate-800">{brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther || "—"}</dd>
            <dt className="text-slate-400">Service Type</dt>
            <dd className="text-slate-800">{serviceType?.label ?? "Not sure yet"}</dd>
            <dt className="text-slate-400">Planned Visit</dt>
            <dd className="text-slate-800">{req.preferredDate ? formatDate(req.preferredDate) : "Not specified"}</dd>
            <dt className="text-slate-400">Submitted</dt>
            <dd className="text-slate-800">{formatDateTime(req.createdAt)}</dd>
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
            <h3 className="text-sm font-semibold text-slate-800">Status</h3>
            <form action={updateWalkInStatus} className="space-y-2">
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
              <h3 className="text-sm font-semibold text-red-600">Delete Registration</h3>
              <p className="text-xs text-slate-500">
                Moves this registration to Trash — it disappears from the normal list but can still be restored later from Trash, or
                deleted permanently from there.
              </p>
              <DeleteButton
                id={req.id}
                action={deleteWalkInRequest}
                confirmMessage={`Move walk-in registration ${req.reference} to Trash? You can restore it later from Trash.`}
                label="Move to Trash"
                className="btn-secondary w-full !text-red-600"
              />
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
