import { redirect } from "next/navigation";
import { getUsers, getTechnicians, getBranches } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const actor = await requireRole("owner_admin");
  if (!actor) redirect("/admin");

  const [allUsers, allTechnicians, allBranches] = await Promise.all([getUsers(), getTechnicians(), getBranches()]);
  const users = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    technicianId: u.technicianId,
    assignedBranchIds: u.assignedBranchIds,
    canManageRequests: u.canManageRequests,
    canViewAllBranches: u.canViewAllBranches,
    active: u.active,
  }));
  const technicians = allTechnicians.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
  const branches = allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Staff Accounts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create logins for owner admins, branch admins, and technicians. Technician logins should link to a Technician record so they only
          see their own assigned jobs.
        </p>
      </div>
      <SettingsTabs />
      <UserManager users={users} technicians={technicians} branches={branches} currentUserId={actor.id} />
    </div>
  );
}
