import { redirect } from "next/navigation";
import { getLookups } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import { createLookup, deleteLookup, updateLookupLabel } from "@/lib/actions";

export default async function ServiceTypesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const lookups = await getLookups();
  const serviceTypes = lookups.filter((l) => l.kind === "service_type" && l.active).sort((a, b) => a.order - b.order);
  const sources = lookups.filter((l) => l.kind === "customer_source" && l.active).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Service Types</h1>
        <p className="mt-1 text-sm text-slate-400">Shown on the public home service form and used across requests. Fully admin-editable.</p>
      </div>
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SimpleLookupTable
          title="Service Types"
          items={serviceTypes}
          createAction={createLookup}
          hiddenFields={{ kind: "service_type" }}
          deleteAction={deleteLookup}
          updateAction={updateLookupLabel}
          placeholder="Add service type..."
        />
        <SimpleLookupTable
          title="Customer / Lead Sources"
          items={sources}
          createAction={createLookup}
          hiddenFields={{ kind: "customer_source" }}
          deleteAction={deleteLookup}
          updateAction={updateLookupLabel}
          placeholder="Add source..."
        />
      </div>
    </div>
  );
}
