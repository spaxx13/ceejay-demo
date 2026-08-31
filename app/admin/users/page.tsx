import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const actor = await requireRole("owner_admin");
  if (!actor) redirect("/admin");

  const users = store.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    technicianId: u.technicianId,
    active: u.active,
  }));
  const technicians = store.technicians.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));

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
      <UserManager users={users} technicians={technicians} currentUserId={actor.id} />
    </div>
  );
}
