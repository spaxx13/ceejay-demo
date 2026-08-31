import Link from "next/link";
import { getNotifications, getRequests } from "@/lib/db";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";

const ICON: Record<string, string> = { request_in_progress: "🔧", checklist_completed: "✅" };

export default async function AdminNotificationsPage() {
  const [allNotifications, requests] = await Promise.all([getNotifications(), getRequests()]);
  const notifications = [...allNotifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-400">{unreadCount} unread of {notifications.length} total.</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="btn-secondary text-xs">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="card text-center text-sm text-slate-400">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const req = requests.find((r) => r.id === n.requestId);
            return (
              <div
                key={n.id}
                className={`card flex items-start justify-between gap-3 ${!n.readAt ? "border-blue-200 bg-blue-50/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{ICON[n.type] ?? "🔔"}</span>
                  <div>
                    <p className="text-sm text-slate-800">{n.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                      {req && (
                        <>
                          {" · "}
                          <Link href={`/admin/requests/${req.id}`} className="text-blue-500 hover:underline">
                            View request
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {!n.readAt && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="btn-secondary shrink-0 !px-2 !py-1 text-[11px]">
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
