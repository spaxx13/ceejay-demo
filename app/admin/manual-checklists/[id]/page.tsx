import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManualRepairRecordById, getManualChecklists, getManualRecordStatus, getBranches, canViewManualRecord } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import { deleteManualChecklist } from "@/lib/actions";
import type { ChecklistItem } from "@/lib/types";

const RESULT_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", na: "N/A" };
const RESULT_CLASS: Record<string, string> = {
  pass: "border-green-200 bg-green-50 text-green-700",
  fail: "border-red-200 bg-red-50 text-red-700",
  na: "border-blue-300 bg-blue-50 text-blue-700",
};

function ChecklistItemsList({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{item.label}</p>
            {item.notes && <p className="text-[11px] text-slate-400">{item.notes}</p>}
          </div>
          <span className={`badge border ${RESULT_CLASS[item.result ?? ""] ?? "border-slate-300 bg-slate-100 text-slate-500"}`}>
            {RESULT_LABEL[item.result ?? ""] ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function ManualChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, record, allChecklists, allBranches] = await Promise.all([
    getCurrentUser(),
    getManualRepairRecordById(id),
    getManualChecklists(),
    getBranches(),
  ]);
  if (!record || record.deletedAt) notFound();
  if (!canViewManualRecord(user, record)) redirect("/admin/manual-checklists");

  const checklists = allChecklists.filter((c) => c.manualRecordId === id);
  const pre = checklists.find((c) => c.phase === "pre_repair");
  const post = checklists.find((c) => c.phase === "post_repair");
  const status = getManualRecordStatus(record, allChecklists);
  const canDelete = user?.role === "owner_admin" || user?.role === "branch_admin";
  const branchName = record.branchId ? allBranches.find((b) => b.id === record.branchId)?.name ?? "—" : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/manual-checklists" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back to Manual Checklists
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{record.reference}</h1>
        </div>
        <div className="flex gap-2">
          {status === "pending" ? (
            <Link href={`/admin/manual-checklists/${record.id}/post-checklist`} className="btn-primary">
              Continue to Post-Repair →
            </Link>
          ) : (
            <a href={`/api/manual-checklist-receipt/${record.id}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
              View Receipt (PDF)
            </a>
          )}
          {canDelete && (
            <DeleteButton id={record.id} action={deleteManualChecklist} confirmMessage={`Delete ticket ${record.reference}? This can't be undone.`} />
          )}
        </div>
      </div>

      <div className="card space-y-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
          <dt className="text-slate-400">Customer</dt>
          <dd className="text-slate-800">{record.customerName}</dd>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-800">{record.customerPhone || "—"}</dd>
          <dt className="text-slate-400">Email</dt>
          <dd className="text-slate-800">{record.customerEmail || "—"}</dd>
          <dt className="text-slate-400">Device</dt>
          <dd className="text-slate-800">{record.deviceLabel}</dd>
          <dt className="text-slate-400">Branch</dt>
          <dd className="text-slate-800">{branchName}</dd>
          <dt className="text-slate-400">Attended By</dt>
          <dd className="text-slate-800">{record.createdByName || "—"}</dd>
          <dt className="text-slate-400">Date</dt>
          <dd className="text-slate-800">{formatDateTime(record.createdAt)}</dd>
        </dl>
      </div>

      {pre && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Checklist</h3>
          <ChecklistItemsList items={pre.items} />
          {pre.summaryNotes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600">Notes</h4>
              <p className="text-sm text-slate-500">{pre.summaryNotes}</p>
            </div>
          )}
        </div>
      )}

      {post && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Post-Repair Checklist</h3>
          <ChecklistItemsList items={post.items} />
          <div>
            <h4 className="text-xs font-semibold text-slate-600">Warranty Coverage</h4>
            <p className="text-sm text-slate-500">{post.warrantyCoverage || "—"}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-600">Receipt Email</h4>
            <p className="text-sm text-slate-500">
              {post.sentToCustomerAt
                ? `Emailed to ${record.customerEmail} on ${formatDateTime(post.sentToCustomerAt)}`
                : record.customerEmail
                  ? "Failed to send — see activity log"
                  : "No email on file"}
            </p>
          </div>
          {post.summaryNotes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600">Notes</h4>
              <p className="text-sm text-slate-500">{post.summaryNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
