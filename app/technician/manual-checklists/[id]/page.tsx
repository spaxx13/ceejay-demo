import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManualRepairRecordById, getManualChecklists, getManualRecordStatus, canViewManualRecord } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
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

export default async function TechnicianManualChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, record, allChecklists] = await Promise.all([getCurrentUser(), getManualRepairRecordById(id), getManualChecklists()]);
  if (!record || record.deletedAt) notFound();
  if (!canViewManualRecord(user, record)) redirect("/technician/manual-checklists");

  const checklists = allChecklists.filter((c) => c.manualRecordId === id);
  const pre = checklists.find((c) => c.phase === "pre_repair");
  const post = checklists.find((c) => c.phase === "post_repair");
  const status = getManualRecordStatus(record, allChecklists);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/technician/manual-checklists" className="text-xs text-slate-400 hover:text-slate-600">
            ← Back
          </Link>
          <h1 className="mt-1 text-lg font-bold text-slate-900">{record.reference}</h1>
        </div>
        {status === "pending" ? (
          <Link href={`/technician/manual-checklists/${record.id}/post-checklist`} className="btn-primary">
            Continue to Post-Repair →
          </Link>
        ) : (
          <a href={`/api/manual-checklist-receipt/${record.id}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
            View Receipt (PDF)
          </a>
        )}
      </div>

      <div className="card space-y-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-slate-400">Customer</dt>
          <dd className="text-slate-800">{record.customerName}</dd>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-800">{record.customerPhone || "—"}</dd>
          <dt className="text-slate-400">Device</dt>
          <dd className="text-slate-800">{record.deviceLabel}</dd>
          <dt className="text-slate-400">Date</dt>
          <dd className="text-slate-800">{formatDateTime(record.createdAt)}</dd>
        </dl>
      </div>

      {pre && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Checklist</h3>
          <ChecklistItemsList items={pre.items} />
        </div>
      )}

      {post && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Post-Repair Checklist</h3>
          <ChecklistItemsList items={post.items} />
        </div>
      )}
    </div>
  );
}
