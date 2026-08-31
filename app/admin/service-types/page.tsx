import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import { createLookup, toggleLookupActive, updateLookupLabel } from "@/lib/actions";

export default async function ServiceTypesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const serviceTypes = store.lookups.filter((l) => l.kind === "service_type").sort((a, b) => a.order - b.order);
  const sources = store.lookups.filter((l) => l.kind === "customer_source").sort((a, b) => a.order - b.order);

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
          toggleAction={toggleLookupActive}
          updateAction={updateLookupLabel}
          placeholder="Add service type..."
        />
        <SimpleLookupTable
          title="Customer / Lead Sources"
          items={sources}
          createAction={createLookup}
          hiddenFields={{ kind: "customer_source" }}
          toggleAction={toggleLookupActive}
          updateAction={updateLookupLabel}
          placeholder="Add source..."
        />
      </div>
    </div>
  );
}
