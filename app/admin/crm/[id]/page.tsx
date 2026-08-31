import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById, getCustomerById, getLookups, getActivity, getRequests, getZones } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { updateLeadStatus, addLeadNote, convertLeadToCustomer, addCustomerNote } from "@/lib/actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CrmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const lead = await getLeadById(id);
  if (lead) {
    const [lookups, activityLog] = await Promise.all([getLookups(), getActivity()]);
    const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
    const currentStatus = leadStatuses.find((s) => s.id === lead.statusId);
    const activity = activityLog.filter((a) => a.entityType === "lead" && a.entityId === lead.id).sort((a, b) => (a.at < b.at ? 1 : -1));

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
              <dt className="text-slate-400">Created</dt>
              <dd className="text-slate-800">{new Date(lead.createdAt).toLocaleString()}</dd>
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
                <p className="text-[11px] text-slate-400">{new Date(a.at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const customer = await getCustomerById(id);
  if (!customer) notFound();
  const [lookups, activityLog, allRequests, zones] = await Promise.all([getLookups(), getActivity(), getRequests(), getZones()]);
  const requests = allRequests.filter((r) => r.customerId === customer.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const requestStatuses = lookups.filter((l) => l.kind === "request_status");
  const zone = zones.find((z) => z.id === customer.zoneId);
  const activity = activityLog.filter((a) => a.entityType === "customer" && a.entityId === customer.id).sort((a, b) => (a.at < b.at ? 1 : -1));

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
              {zone ? `, ${zone.name}` : ""}
              {customer.province ? `, ${customer.province}` : ""}
            </dd>
            <dt className="text-slate-400">Source</dt>
            <dd className="text-slate-800">{customer.source}</dd>
            <dt className="text-slate-400">Customer Since</dt>
            <dd className="text-slate-800">{new Date(customer.createdAt).toLocaleDateString()}</dd>
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
                    <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  {status && <StatusBadge label={status.label} />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Activity Log</h3>
        <ul className="space-y-2 text-sm">
          {activity.length === 0 && <li className="text-slate-400">No activity yet.</li>}
          {activity.map((a) => (
            <li key={a.id} className="border-b border-slate-200 pb-2 last:border-0">
              <p className="text-slate-700">{a.message}</p>
              <p className="text-[11px] text-slate-400">{new Date(a.at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
