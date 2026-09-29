import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManualRepairRecordById, getManualChecklists, getManualRecordStatus, getBranches, canViewManualRecord } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import DeleteButton from "@/components/DeleteButton";
import ManualResendReceiptButton from "@/components/ManualResendReceiptButton";
import { deleteManualChecklist, updateManualRecordDetails } from "@/lib/actions";
import type { ChecklistItem } from "@/lib/types";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
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
          <div className="flex items-center justify-between rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2">
            <span className="text-sm font-semibold text-blue-900">Total Amount (Repair Price + Labor/Service Cost)</span>
            <span className="text-lg font-bold text-blue-900">{peso(post.cost + post.laborCost)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
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
            <ManualResendReceiptButton manualRecordId={record.id} email={record.customerEmail} />
          </div>
          {post.summaryNotes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600">Notes</h4>
              <p className="text-sm text-slate-500">{post.summaryNotes}</p>
            </div>
          )}
        </div>
      )}

      <details className="card print:hidden">
        <summary className="cursor-pointer text-sm font-medium text-blue-700">Edit Customer & Ticket Details</summary>
        <form action={updateManualRecordDetails} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={record.id} />
          <p className="text-xs text-slate-500">
            Fix any incorrect or missing information — this stays editable even after completion. This won&apos;t automatically resend the
            receipt; use &quot;Resend Receipt&quot; above for that.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Customer Name *</label>
              <input name="customerName" required defaultValue={record.customerName} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Branch</label>
              <select name="branchId" defaultValue={record.branchId ?? ""} className="input">
                <option value="">—</option>
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Contact Number</label>
              <input name="customerPhone" defaultValue={record.customerPhone} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Email</label>
              <input name="customerEmail" type="email" defaultValue={record.customerEmail} className="input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Device *</label>
              <input name="deviceLabel" required defaultValue={record.deviceLabel} className="input" />
            </div>
          </div>
          {post && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Warranty Coverage</label>
                <textarea name="warrantyCoverage" rows={2} defaultValue={post.warrantyCoverage} className="input" />
              </div>
              <p className="text-xs font-medium text-slate-500">Pricing</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Repair Price (₱)</label>
                  <input name="cost" type="number" min={0} step="0.01" defaultValue={post.cost} className="input" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Labor/Service Cost (₱)</label>
                  <input name="laborCost" type="number" min={0} step="0.01" defaultValue={post.laborCost} className="input" />
                </div>
              </div>
              <p className="text-xs font-medium text-slate-500">Expenses (internal-only — never shown to the customer)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
                  <input name="partsCost" type="number" min={0} step="0.01" defaultValue={post.partsCost} className="input" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Other Expenses (₱)</label>
                  <input name="otherExpenses" type="number" min={0} step="0.01" defaultValue={post.otherExpenses} className="input" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Notes</label>
                <textarea name="summaryNotes" rows={2} defaultValue={post.summaryNotes} className="input" />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary w-full">
            Save Details
          </button>
        </form>
      </details>
    </div>
  );
}
