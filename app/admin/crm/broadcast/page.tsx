import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeads, getCustomers, getCrmBroadcasts } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cancelScheduledBroadcast } from "@/lib/actions";
import BroadcastForm from "@/components/BroadcastForm";
import DeleteButton from "@/components/DeleteButton";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

export default async function CrmBroadcastPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner_admin") redirect("/admin/crm");

  const [leads, customers, broadcasts] = await Promise.all([getLeads(), getCustomers(), getCrmBroadcasts()]);
  const recipientCount = new Set(
    [...leads, ...customers].map((p) => p.email.toLowerCase().trim()).filter(Boolean)
  ).size;

  const pending = broadcasts.filter((b) => b.status === "pending").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const history = broadcasts.filter((b) => b.status !== "pending").slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to CRM
        </Link>
        <h1 className="mt-1 text-lg font-bold text-slate-900">📣 Send Announcement</h1>
        <p className="text-sm text-slate-400">Email a promo or announcement to everyone in your CRM with an address on file.</p>
      </div>

      <BroadcastForm recipientCount={recipientCount} />

      {pending.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Scheduled</h3>
          {pending.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{b.subject}</p>
                <p className="text-xs text-slate-400">
                  Sends {formatDateTime(b.scheduledAt!)} — ~{b.recipientEstimate} recipient{b.recipientEstimate === 1 ? "" : "s"}
                  {b.photos.length > 0 && ` · ${b.photos.length} photo${b.photos.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <DeleteButton
                id={b.id}
                action={cancelScheduledBroadcast}
                confirmMessage={`Cancel the scheduled announcement "${b.subject}"? It will not be sent.`}
                label="Cancel"
              />
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Recently Sent</h3>
          {history.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{b.subject}</p>
                <p className="text-xs text-slate-400">
                  {b.sentAt ? formatDateTime(b.sentAt) : formatDateTime(b.createdAt)}
                  {b.status !== "cancelled" && ` — sent to ${b.sentCount} of ${b.sentCount + b.failedCount}`}
                </p>
              </div>
              <StatusBadge label={b.status === "failed" ? "Failed" : b.status === "cancelled" ? "Cancelled" : "Sent"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
