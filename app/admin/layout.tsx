import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, canManageHomeServiceRequests, canManageWalkIns, canAccessCrm, canManageRepairPricing } from "@/lib/db";
import AdminNav from "@/components/AdminNav";
import PwaNotificationBar from "@/components/PwaNotificationBar";
import AppBadgeSync from "@/components/AppBadgeSync";
import RefreshButton from "@/components/RefreshButton";
import StaffPushNotificationRegistrar from "@/components/StaffPushNotificationRegistrar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "technician") redirect("/technician");
  if (user.role === "rider") redirect("/rider");

  const unreadCount = (await getNotifications()).filter((n) => !n.readAt).length;

  return (
    <>
      <AppBadgeSync count={unreadCount} />
      <StaffPushNotificationRegistrar />
      <PwaNotificationBar unreadCount={unreadCount} />
      <div className="min-h-screen md:flex">
        <AdminNav
          userName={user.name}
          role={user.role}
          canManageRequests={canManageHomeServiceRequests(user)}
          canManageWalkIns={canManageWalkIns(user)}
          canAccessCrm={canAccessCrm(user)}
          canManageRepairPricing={canManageRepairPricing(user)}
          unreadCount={unreadCount}
          vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
          <div className="mx-auto max-w-6xl print:max-w-none">{children}</div>
        </main>
      </div>
      <RefreshButton />
    </>
  );
}
