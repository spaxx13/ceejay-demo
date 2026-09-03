import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, canManageHomeServiceRequests } from "@/lib/db";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "technician") redirect("/technician");

  const unreadCount = (await getNotifications()).filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen md:flex">
      <AdminNav userName={user.name} role={user.role} canManageRequests={canManageHomeServiceRequests(user)} unreadCount={unreadCount} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
        <div className="mx-auto max-w-6xl print:max-w-none">{children}</div>
      </main>
    </div>
  );
}
