import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import TechnicianManager from "@/components/TechnicianManager";

export default async function TechniciansPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const technicians = store.technicians.map((t) => ({
    id: t.id,
    name: t.name,
    contactNumber: t.contactNumber,
    email: t.email,
    employmentStatus: t.employmentStatus,
    branchIds: t.branchIds,
    zoneIds: t.zoneIds,
    active: t.active,
  }));
  const branches = store.branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));
  const zones = store.zones.filter((z) => z.active).map((z) => ({ id: z.id, name: z.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Technicians</h1>
        <p className="mt-1 text-sm text-slate-400">Manage technicians and assign them to branches and zones.</p>
      </div>
      <SettingsTabs />
      <TechnicianManager technicians={technicians} branches={branches} zones={zones} />
    </div>
  );
}
