import { redirect } from "next/navigation";
import { getLookups, getDeviceModels } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import DeviceModelManager from "@/components/DeviceModelManager";
import { createDeviceBrand, deleteLookup, updateLookupLabel } from "@/lib/actions";

export default async function DeviceCatalogPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [lookups, allModels] = await Promise.all([getLookups(), getDeviceModels()]);
  const brands = lookups.filter((l) => l.kind === "device_brand" && l.active).sort((a, b) => a.order - b.order);
  const models = allModels.filter((m) => m.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Device Brands &amp; Models</h1>
        <p className="mt-1 text-sm text-slate-400">Apple models are pre-seeded as a convenience — everything here is editable, nothing is hardcoded.</p>
      </div>
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SimpleLookupTable title="Brands" items={brands} createAction={createDeviceBrand} deleteAction={deleteLookup} updateAction={updateLookupLabel} placeholder="Add brand..." />
        <DeviceModelManager brands={brands.map((b) => ({ id: b.id, label: b.label }))} models={models} />
      </div>
    </div>
  );
}
