import { redirect } from "next/navigation";
import { getLookups, getDeviceModels } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import SimpleLookupTable from "@/components/SimpleLookupTable";
import DeviceModelManager from "@/components/DeviceModelManager";
import { createDeviceBrand, toggleLookupActive, updateLookupLabel } from "@/lib/actions";

export default async function DeviceCatalogPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [lookups, models] = await Promise.all([getLookups(), getDeviceModels()]);
  const brands = lookups.filter((l) => l.kind === "device_brand").sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Device Brands &amp; Models</h1>
        <p className="mt-1 text-sm text-slate-400">Apple models are pre-seeded as a convenience — everything here is editable, nothing is hardcoded.</p>
      </div>
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SimpleLookupTable title="Brands" items={brands} createAction={createDeviceBrand} toggleAction={toggleLookupActive} updateAction={updateLookupLabel} placeholder="Add brand..." />
        <DeviceModelManager brands={brands.filter((b) => b.active).map((b) => ({ id: b.id, label: b.label }))} models={models} />
      </div>
    </div>
  );
}
