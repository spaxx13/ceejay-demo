import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import StatusTable from "@/components/StatusTable";
import { createLookup, toggleLookupActive, reorderLookup } from "@/lib/actions";

export default async function StatusesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const leadStatuses = store.lookups.filter((l) => l.kind === "lead_status").sort((a, b) => a.order - b.order);
  const requestStatuses = store.lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Lead &amp; Request Statuses</h1>
        <p className="mt-1 text-sm text-slate-400">
          These lists drive the status dropdowns across the CRM and Home Service Requests. Reorder controls what shows first in each workflow.
        </p>
      </div>
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusTable title="Lead Statuses" kind="lead_status" items={leadStatuses} createAction={createLookup} toggleAction={toggleLookupActive} reorderAction={reorderLookup} />
        <StatusTable title="Home Service Request Statuses" kind="request_status" items={requestStatuses} createAction={createLookup} toggleAction={toggleLookupActive} reorderAction={reorderLookup} />
      </div>
    </div>
  );
}
