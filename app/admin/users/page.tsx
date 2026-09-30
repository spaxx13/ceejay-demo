import { redirect } from "next/navigation";
import { getUsers, getTechnicians, getRiders, getBranches } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const actor = await requireRole("owner_admin");
  if (!actor) redirect("/admin");

  const [allUsers, allTechnicians, allRiders, allBranches] = await Promise.all([getUsers(), getTechnicians(), getRiders(), getBranches()]);
  const users = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    technicianId: u.technicianId,
    riderId: u.riderId,
    assignedBranchIds: u.assignedBranchIds,
    canManageRequests: u.canManageRequests,
    canDeleteRequests: u.canDeleteRequests,
    canViewAllBranches: u.canViewAllBranches,
    canAccessCrm: u.canAccessCrm,
    canManageWalkIns: u.canManageWalkIns,
    canWaiveServiceFee: u.canWaiveServiceFee,
    canManageRepairPricing: u.canManageRepairPricing,
    canManageManualChecklists: u.canManageManualChecklists,
    phone: u.phone,
    active: u.active,
  }));
  const technicians = allTechnicians.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name, branchIds: t.branchIds }));
  const riders = allRiders.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Staff Accounts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create logins for owner admins, branch admins, technicians, and riders. A technician or rider login only sees jobs assigned to
          them.
        </p>
      </div>
      <SettingsTabs />
      <UserManager users={users} technicians={technicians} riders={riders} branches={branches} currentUserId={actor.id} />
    </div>
  );
}
