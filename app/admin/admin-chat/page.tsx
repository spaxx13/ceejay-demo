import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getStaffChatMessages } from "@/lib/db";
import StaffChatView from "@/components/StaffChatView";

// Same chat mechanics as /staff-chat (StaffChatView, polling), just scoped
// to the "admin" room — owner admin + branch admin only, enforced
// server-side in postStaffChatMessage/pollStaffChatMessages, not just by
// this page living under /admin.
export default async function AdminChatPage() {
  const user = await requireRole("owner_admin", "branch_admin");
  if (!user) redirect("/admin");

  const messages = await getStaffChatMessages("admin");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Admin Chat</h1>
        <p className="mt-1 text-sm text-slate-400">Owner admins and branch admins only — technicians and riders can&apos;t see this room.</p>
      </div>
      <div className="card">
        <StaffChatView initial={messages} currentUserId={user.id} room="admin" />
      </div>
    </div>
  );
}
