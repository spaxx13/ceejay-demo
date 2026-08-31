import Link from "next/link";
import { getLookups, getZones, getLeads, getCustomers } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { createLead, createCustomer } from "@/lib/actions";
import { formatDate } from "@/lib/format";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").toLowerCase();

  const [lookups, zones, allLeads, allCustomers] = await Promise.all([getLookups(), getZones(), getLeads(), getCustomers()]);
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const sources = lookups.filter((l) => l.kind === "customer_source" && l.active).sort((a, b) => a.order - b.order);

  let leads = [...allLeads].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  let customers = [...allCustomers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (query) {
    leads = leads.filter((l) => l.name.toLowerCase().includes(query) || l.phone.includes(query));
    customers = customers.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM — Leads &amp; Customers</h1>
          <p className="mt-1 text-sm text-slate-400">Search history, follow up on leads, and manage customer records.</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="Search by name or phone..." className="input w-64" />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Leads ({leads.length})</h2>
        </div>
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
                <th className="pb-2 pr-3">Follow-up</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No leads yet.
                  </td>
                </tr>
              )}
              {leads.map((l) => {
                const status = leadStatuses.find((s) => s.id === l.statusId);
                return (
                  <tr key={l.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-2.5 pr-3 text-slate-800">{l.name}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{l.phone || "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{l.source || "—"}</td>
                    <td className="py-2.5 pr-3">{status && <StatusBadge label={status.label} />}</td>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Customers ({customers.length})</h2>
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
            <select name="zoneId" className="input">
              <option value="">Zone...</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
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
                    No customers yet.
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
    </div>
  );
}
