import { redirect } from "next/navigation";
import { getBranches } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import BranchManager from "@/components/BranchManager";

export default async function BranchesPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const branches = (await getBranches()).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    contactNumber: b.contactNumber,
    active: b.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Branches</h1>
        <p className="mt-1 text-sm text-slate-400">Physical locations customers can visit. Referenced by technicians, zones, and inventory.</p>
      </div>
      <SettingsTabs />
      <BranchManager branches={branches} />
    </div>
  );
}
