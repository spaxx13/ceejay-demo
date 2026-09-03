import { redirect } from "next/navigation";
import { getTechnicians, getBranches } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import TechnicianManager from "@/components/TechnicianManager";

export default async function TechniciansPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const [allTechnicians, allBranches] = await Promise.all([getTechnicians(), getBranches()]);
  const technicians = allTechnicians.map((t) => ({
    id: t.id,
    name: t.name,
    contactNumber: t.contactNumber,
    email: t.email,
    employmentStatus: t.employmentStatus,
    branchIds: t.branchIds,
    active: t.active,
  }));
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Technicians</h1>
        <p className="mt-1 text-sm text-slate-400">Manage technicians and assign them to branches.</p>
      </div>
      <SettingsTabs />
      <TechnicianManager technicians={technicians} branches={branches} />
    </div>
  );
}
