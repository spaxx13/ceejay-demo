import { redirect } from "next/navigation";
import { getZones, getTechnicians } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import ZoneManager from "@/components/ZoneManager";

export default async function ZonesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [allZones, allTechnicians] = await Promise.all([getZones(), getTechnicians()]);
  const zones = allZones.map((z) => ({
    id: z.id,
    name: z.name,
    city: z.city,
    province: z.province,
    notes: z.notes,
    active: z.active,
    technicianIds: allTechnicians.filter((t) => t.zoneIds.includes(z.id)).map((t) => t.id),
  }));
  const technicians = allTechnicians.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name, active: t.active }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Zones</h1>
        <p className="mt-1 text-sm text-slate-400">
          Service areas used to auto-route home service requests to technicians. Starts empty — add zones as coverage is confirmed.
        </p>
      </div>
      <SettingsTabs />
      <ZoneManager zones={zones} technicians={technicians} />
    </div>
  );
}
