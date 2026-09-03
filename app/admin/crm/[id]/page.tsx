import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById, getCustomerById, getLookups, getActivity, getRequests, getRepairRecords, getUsers, getServiceAgreements, getRepairRecordStatus } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { updateLeadStatus, addLeadNote, convertLeadToCustomer, addCustomerNote, assignLead } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/format";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CrmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const lead = await getLeadById(id);
  if (lead) {
    const [lookups, activityLog, users] = await Promise.all([getLookups(), getActivity(), getUsers()]);
    const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
    const currentStatus = leadStatuses.find((s) => s.id === lead.statusId);
    const activity = activityLog.filter((a) => a.entityType === "lead" && a.entityId === lead.id).sort((a, b) => (a.at < b.at ? 1 : -1));
    const staff = users.filter((u) => u.active);
    const assignee = staff.find((u) => u.id === lead.assignedTo);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/crm" className="text-xs text-slate-400 hover:text-slate-600">
              ← Back to CRM
            </Link>
            <h1 className="mt-1 text-lg font-bold text-slate-900">{lead.name}</h1>
            <p className="text-xs text-slate-400">Lead · {lead.phone || "no phone"}</p>
          </div>
          {currentStatus && <StatusBadge label={currentStatus.label} />}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Lead Info</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">Email</dt>
              <dd className="text-slate-800">{lead.email || "—"}</dd>
              <dt className="text-slate-400">Source</dt>
              <dd className="text-slate-800">{lead.source || "—"}</dd>
              <dt className="text-slate-400">Follow-up</dt>
              <dd className="text-slate-800">{lead.followUpDate ?? "—"}</dd>
              <dt className="text-slate-400">Assigned to</dt>
              <dd className="text-slate-800">{assignee?.name ?? "Unassigned"}</dd>
              <dt className="text-slate-400">Created</dt>
              <dd className="text-slate-800">{formatDateTime(lead.createdAt)}</dd>
            </dl>
            {lead.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-600">{lead.notes}</p>}

            {!lead.customerId && (
              <form action={convertLeadToCustomer}>
                <input type="hidden" name="id" value={lead.id} />
                <button type="submit" className="btn-primary w-full">
                  Convert to Customer
                </button>
              </form>
            )}
            {lead.customerId && (
              <Link href={`/admin/crm/${lead.customerId}`} className="btn-secondary block text-center">
                View linked customer →
              </Link>
            )}
          </div>

          <div className="space-y-6">
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Change Status</h3>
              <form action={updateLeadStatus} className="space-y-2">
                <input type="hidden" name="id" value={lead.id} />
                <select name="statusId" defaultValue={lead.statusId} className="input">
                  {leadStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary w-full">
                  Update
                </button>
              </form>
            </div>
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Assign To</h3>
              <form action={assignLead} className="space-y-2">
                <input type="hidden" name="id" value={lead.id} />
                <select name="assignedTo" defaultValue={lead.assignedTo ?? ""} className="input">
                  <option value="">Unassigned</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary w-full">
                  Update
                </button>
              </form>
            </div>
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Log Follow-up / Note</h3>
              <form action={addLeadNote} className="space-y-2">
                <input type="hidden" name="id" value={lead.id} />
                <textarea name="note" rows={3} className="input" placeholder="Inquiry note or call summary..." />
                <input name="followUpDate" type="date" className="input" />
                <button type="submit" className="btn-secondary w-full">
                  Add Note
                </button>
              </form>
            </div>
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

  const customer = await getCustomerById(id);
  if (!customer) notFound();
  const [lookups, activityLog, allRequests, allRepairRecords, agreements] = await Promise.all([
    getLookups(),
    getActivity(),
    getRequests(),
    getRepairRecords(),
    getServiceAgreements(),
  ]);
  const requests = allRequests.filter((r) => r.customerId === customer.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const repairRecords = allRepairRecords.filter((r) => r.customerId === customer.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const totalSpent = repairRecords.filter((r) => !r.cancelled).reduce((sum, r) => sum + r.cost, 0);
  const requestStatuses = lookups.filter((l) => l.kind === "request_status");
  const activity = activityLog.filter((a) => a.entityType === "customer" && a.entityId === customer.id).sort((a, b) => (a.at < b.at ? 1 : -1));
  const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to CRM
        </Link>
        <h1 className="mt-1 text-lg font-bold text-slate-900">{customer.name}</h1>
        <p className="text-xs text-slate-400">Customer · {customer.phone || "no phone"}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Customer Info</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-800">{customer.email || "—"}</dd>
            <dt className="text-slate-400">Address</dt>
            <dd className="text-slate-800">
              {customer.street || "—"}
              {customer.province ? `, ${customer.province}` : ""}
            </dd>
            <dt className="text-slate-400">Source</dt>
            <dd className="text-slate-800">{customer.source}</dd>
            <dt className="text-slate-400">Customer Since</dt>
            <dd className="text-slate-800">{formatDate(customer.createdAt)}</dd>
          </dl>
          {customer.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-600">{customer.notes}</p>}
          <form action={addCustomerNote} className="space-y-2">
            <input type="hidden" name="id" value={customer.id} />
            <textarea name="note" rows={2} className="input" placeholder="Add a note..." />
            <button type="submit" className="btn-secondary w-full">
              Add Note
            </button>
          </form>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Home Service History ({requests.length})</h3>
          <ul className="space-y-2">
            {requests.length === 0 && <li className="text-sm text-slate-400">No requests yet.</li>}
            {requests.map((r) => {
              const status = requestStatuses.find((s) => s.id === r.statusId);
              return (
                <li key={r.id} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-0">
                  <div>
                    <Link href={`/admin/requests/${r.id}`} className="font-mono text-xs text-blue-300 hover:underline">
                      {r.reference}
                    </Link>
                    <p className="text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                  </div>
                  {status && <StatusBadge label={status.label} />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Repair History ({repairRecords.length})</h3>
          {repairRecords.length > 0 && <p className="text-xs text-slate-400">Total spent: {peso(totalSpent)}</p>}
        </div>
        <ul className="space-y-2">
          {repairRecords.length === 0 && <li className="text-sm text-slate-400">No repairs on record yet.</li>}
          {repairRecords.map((r) => {
            const status = getRepairRecordStatus(r, agreements);
            return (
              <li key={r.id} className={`flex items-center justify-between border-b border-slate-200 pb-2 last:border-0 ${status === "cancelled" ? "opacity-60" : ""}`}>
                <div>
                  <Link href={`/admin/pos/${r.id}`} className="font-mono text-xs text-blue-300 hover:underline">
                    {r.reference}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatDate(r.serviceDate)} · {r.deviceModel || "—"} · {r.technicianName || "no technician"}
                    {status === "cancelled" && <span className="ml-1.5 badge border border-red-200 bg-red-50 text-red-700">Cancelled</span>}
                    {status === "pending" && <span className="ml-1.5 badge border border-amber-200 bg-amber-50 text-amber-700">Pending</span>}
                  </p>
                </div>
                <span className="text-sm font-medium text-slate-800">{peso(r.cost)}</span>
              </li>
            );
          })}
        </ul>
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
