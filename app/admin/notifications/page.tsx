import Link from "next/link";
import { getNotifications, getRequests, getWalkInRequests } from "@/lib/db";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";

const ICON: Record<string, string> = { new_request: "📥", request_in_progress: "🔧", checklist_completed: "✅", new_walkin: "🚶", technician_on_the_way: "🛵" };

export default async function AdminNotificationsPage() {
  const [allNotifications, requests, walkIns] = await Promise.all([getNotifications(), getRequests(), getWalkInRequests()]);
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
            const req = n.requestId ? requests.find((r) => r.id === n.requestId) : undefined;
            const walkIn = n.walkinRequestId ? walkIns.find((w) => w.id === n.walkinRequestId) : undefined;
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
                      {formatDateTime(n.createdAt)}
                      {req && (
                        <>
                          {" · "}
                          <Link href={`/admin/requests/${req.id}`} className="text-blue-500 hover:underline">
                            View request
                          </Link>
                        </>
                      )}
                      {walkIn && (
                        <>
                          {" · "}
                          <Link href={`/admin/walk-ins/${walkIn.id}`} className="text-blue-500 hover:underline">
                            View registration
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
