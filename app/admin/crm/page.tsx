import Link from "next/link";
import { redirect } from "next/navigation";
import { getLookups, getLeads, getCustomers, getUsers, getBranches, isBranchHidden, canAccessCrm } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { createLead, createCustomer } from "@/lib/actions";
import { formatDate } from "@/lib/format";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; status?: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessCrm(user)) redirect("/admin");

  const { type: rawType, q, status: statusFilter } = await searchParams;
  const typeFilter = rawType === "leads" || rawType === "customers" ? rawType : "all";
  const query = (q ?? "").toLowerCase();

  const [lookups, allLeadsRaw, allCustomers, users, allBranches] = await Promise.all([
    getLookups(),
    getLeads(),
    getCustomers(),
    getUsers(),
    getBranches(),
  ]);
  const leadStatuses = lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const sources = lookups.filter((l) => l.kind === "customer_source" && l.active).sort((a, b) => a.order - b.order);
  const branches = allBranches.filter((b) => b.active);

  // Branch scoping — a lead is tied to the branch the inquiry is about
  // (set on website contact-form leads), so a branch admin only sees leads
  // for their assigned branch(es); leads with no branch (e.g. manually
  // added) stay visible to everyone.
  const visibleLeads = allLeadsRaw.filter((l) => !isBranchHidden(user, l.branchId));

  // One row per person, not one per record: once a lead converts it gets
  // its own customer row, so the original lead is dropped here — showing
  // both was the exact "which tab is this person in?" confusion this page
  // used to cause. Everyone still shows up exactly once.
  type PersonRow = {
    id: string;
    type: "lead" | "customer";
    name: string;
    phone: string;
    email: string;
    statusLabel: string;
    source: string;
    branch: string;
    assignee: string;
    followUpDate: string | null;
    createdAt: string;
  };

  const leadRows: PersonRow[] = visibleLeads
    .filter((l) => !l.customerId)
    .map((l) => ({
      id: l.id,
      type: "lead",
      name: l.name,
      phone: l.phone,
      email: l.email,
      statusLabel: leadStatuses.find((s) => s.id === l.statusId)?.label ?? "Lead",
      source: l.source || "—",
      branch: branches.find((b) => b.id === l.branchId)?.name ?? "—",
      assignee: users.find((u) => u.id === l.assignedTo)?.name ?? "—",
      followUpDate: l.followUpDate,
      createdAt: l.createdAt,
    }));

  const customerRows: PersonRow[] = allCustomers.map((c) => ({
    id: c.id,
    type: "customer",
    name: c.name,
    phone: c.phone,
    email: c.email,
    statusLabel: "Customer",
    source: c.source || "—",
    branch: "—",
    assignee: "—",
    followUpDate: null,
    createdAt: c.createdAt,
  }));

  let people = [...leadRows, ...customerRows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (typeFilter !== "all") people = people.filter((p) => p.type === typeFilter.slice(0, -1));
  if (statusFilter) people = people.filter((p) => p.type === "lead" && leadStatuses.find((s) => s.label === p.statusLabel)?.id === statusFilter);
  if (query) people = people.filter((p) => p.name.toLowerCase().includes(query) || p.phone.includes(query) || p.email.toLowerCase().includes(query));

  const typeLink = (t: string) => `/admin/crm?type=${t}`;
  const typeClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-blue-200 text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM — People</h1>
          <p className="mt-1 text-sm text-slate-400">Everyone in one list — leads until they convert, then their customer record.</p>
        </div>
        {user?.role === "owner_admin" && (
          <Link href="/admin/crm/broadcast" className="btn-primary !py-2 text-sm">
            📣 Send Announcement
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          <Link href={typeLink("all")} className={typeClass(typeFilter === "all")}>
            All ({leadRows.length + customerRows.length})
          </Link>
          <Link href={typeLink("leads")} className={typeClass(typeFilter === "leads")}>
            Leads ({leadRows.length})
          </Link>
          <Link href={typeLink("customers")} className={typeClass(typeFilter === "customers")}>
            Customers ({customerRows.length})
          </Link>
        </div>
        <form className="mb-2 flex w-full flex-wrap gap-2 sm:w-auto">
          <input type="hidden" name="type" value={typeFilter} />
          <input name="q" defaultValue={q ?? ""} placeholder="Search by name, phone, or email..." className="input w-full sm:w-64" />
          {typeFilter !== "customers" && (
            <select name="status" defaultValue={statusFilter ?? ""} className="input w-full sm:w-40">
              <option value="">All lead statuses</option>
              {leadStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-secondary flex-1 sm:flex-none">
            Search
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">+ Add Lead</summary>
          <form action={createLead} className="mt-3 grid grid-cols-1 gap-3">
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
            <select name="branchId" className="input">
              <option value="">Branch...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input name="followUpDate" type="date" className="input" />
            <input name="notes" placeholder="Notes" className="input" />
            <button type="submit" className="btn-primary">
              Add Lead
            </button>
          </form>
        </details>
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">+ Add Customer</summary>
          <form action={createCustomer} className="mt-3 grid grid-cols-1 gap-3">
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
      </div>

      {/* Mobile: one card per person. */}
      <div className="space-y-3 sm:hidden">
        {people.length === 0 && <p className="card text-center text-sm text-slate-400">No one found.</p>}
        {people.map((p) => (
          <div key={`${p.type}-${p.id}`} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{p.name}</p>
              <StatusBadge label={p.statusLabel} />
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Phone</span>
              <span className="text-right text-slate-600">{p.phone || "—"}</span>
              <span className="text-slate-400">Email</span>
              <span className="text-right text-slate-600">{p.email || "—"}</span>
              <span className="text-slate-400">Source</span>
              <span className="text-right text-slate-600">{p.source}</span>
              {p.type === "lead" && (
                <>
                  <span className="text-slate-400">Follow-up</span>
                  <span className="text-right text-slate-600">{p.followUpDate ?? "—"}</span>
                </>
              )}
              {p.type === "customer" && (
                <>
                  <span className="text-slate-400">Since</span>
                  <span className="text-right text-slate-600">{formatDate(p.createdAt)}</span>
                </>
              )}
            </div>
            <Link href={`/admin/crm/${p.id}`} className="btn-secondary block text-center !py-1.5 text-xs">
              View
            </Link>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Phone</th>
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3">Source</th>
              <th className="pb-2 pr-3">Assigned</th>
              <th className="pb-2 pr-3">Follow-up / Since</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400">
                  No one found.
                </td>
              </tr>
            )}
            {people.map((p) => (
              <tr key={`${p.type}-${p.id}`} className="border-b border-slate-200 last:border-0">
                <td className="py-2.5 pr-3 text-slate-800">{p.name}</td>
                <td className="py-2.5 pr-3 text-slate-500">{p.phone || "—"}</td>
                <td className="py-2.5 pr-3 text-slate-500">{p.email || "—"}</td>
                <td className="py-2.5 pr-3">
                  <StatusBadge label={p.statusLabel} />
                </td>
                <td className="py-2.5 pr-3 text-slate-500">{p.source}</td>
                <td className="py-2.5 pr-3 text-slate-500">{p.assignee}</td>
                <td className="py-2.5 pr-3 text-slate-500">{p.type === "lead" ? p.followUpDate ?? "—" : formatDate(p.createdAt)}</td>
                <td className="py-2.5">
                  <Link href={`/admin/crm/${p.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
