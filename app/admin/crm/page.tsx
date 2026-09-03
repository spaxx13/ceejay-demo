import Link from "next/link";
import { getLookups, getLeads, getCustomers, getUsers } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { createLead, createCustomer } from "@/lib/actions";
import { formatDate } from "@/lib/format";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string }> }) {
  const { tab: rawTab, q, status: statusFilter } = await searchParams;
  const tab = rawTab === "customers" ? "customers" : "leads";
  const query = (q ?? "").toLowerCase();

  const [lookups, allLeads, allCustomers, users] = await Promise.all([getLookups(), getLeads(), getCustomers(), getUsers()]);
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const sources = lookups.filter((l) => l.kind === "customer_source" && l.active).sort((a, b) => a.order - b.order);

  let leads = [...allLeads].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  let customers = [...allCustomers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (query) {
    leads = leads.filter((l) => l.name.toLowerCase().includes(query) || l.phone.includes(query));
    customers = customers.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query));
  }
  if (tab === "leads" && statusFilter) {
    leads = leads.filter((l) => l.statusId === statusFilter);
  }

  const tabLink = (t: string) => `/admin/crm?tab=${t}`;
  const tabClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CRM — Leads &amp; Customers</h1>
        <p className="mt-1 text-sm text-slate-400">Follow up on leads until they convert, then manage customer records and their history.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          <Link href={tabLink("leads")} className={tabClass(tab === "leads")}>
            Leads ({allLeads.length})
          </Link>
          <Link href={tabLink("customers")} className={tabClass(tab === "customers")}>
            Customers ({allCustomers.length})
          </Link>
        </div>
        <form className="mb-2 flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q ?? ""} placeholder={`Search ${tab} by name or phone...`} className="input w-64" />
          {tab === "leads" && (
            <select name="status" defaultValue={statusFilter ?? ""} className="input w-40">
              <option value="">All statuses</option>
              {leadStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {tab === "leads" ? (
        <section className="space-y-3">
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">+ Add Lead</summary>
            <form action={createLead} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input name="name" required placeholder="Name *" className="input" />
              <input name="phone" placeholder="Phone" className="input" />
              <input name="email" placeholder="Email" className="input" />
              <select name="source" className="input">
                <option value="">Source...</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input name="followUpDate" type="date" className="input" />
              <input name="notes" placeholder="Notes" className="input sm:col-span-2 lg:col-span-2" />
              <button type="submit" className="btn-primary">
                Add Lead
              </button>
            </form>
          </details>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Assigned</th>
                  <th className="pb-2 pr-3">Follow-up</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No leads found.
                    </td>
                  </tr>
                )}
                {leads.map((l) => {
                  const leadStatus = leadStatuses.find((s) => s.id === l.statusId);
                  const assignee = users.find((u) => u.id === l.assignedTo);
                  return (
                    <tr key={l.id} className="border-b border-slate-200 last:border-0">
                      <td className="py-2.5 pr-3 text-slate-800">{l.name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{l.phone || "—"}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{l.source || "—"}</td>
                      <td className="py-2.5 pr-3">{leadStatus && <StatusBadge label={leadStatus.label} />}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{assignee?.name ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{l.followUpDate ?? "—"}</td>
                      <td className="py-2.5">
                        <Link href={`/admin/crm/${l.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">+ Add Customer</summary>
            <form action={createCustomer} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input name="name" required placeholder="Name *" className="input" />
              <input name="phone" placeholder="Phone" className="input" />
              <input name="email" placeholder="Email" className="input" />
              <select name="source" className="input">
                <option value="">Source...</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input name="street" placeholder="Street" className="input" />
              <input name="province" placeholder="Province" className="input" />
              <input name="landmark" placeholder="Landmark" className="input" />
              <button type="submit" className="btn-primary">
                Add Customer
              </button>
            </form>
          </details>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Since</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No customers found.
                    </td>
                  </tr>
                )}
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-2.5 pr-3 text-slate-800">{c.name}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{c.phone || "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{c.source}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="py-2.5">
                      <Link href={`/admin/crm/${c.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
