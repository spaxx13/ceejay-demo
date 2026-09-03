import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepairRecordById, getServiceAgreements, getRepairRecordStatus, getBranches, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, formatDate } from "@/lib/format";
import PrintReceiptButton from "@/components/PrintReceiptButton";
import PopupLink from "@/components/PopupLink";
import ResendReceiptButton from "@/components/ResendReceiptButton";
import { cancelRepairRecord, updateRepairRecordDetails } from "@/lib/actions";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RESULT_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", na: "N/A" };

export default async function RepairRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRepairRecordById(id);
  if (!record) notFound();

  const [user, agreements, allBranches] = await Promise.all([getCurrentUser(), getServiceAgreements(), getBranches()]);
  if (isBranchHidden(user, record.branchId)) notFound();
  const branches = allBranches.filter((b) => b.active && !isBranchHidden(user, b.id));
  const branch = allBranches.find((b) => b.id === record.branchId);
  const pre = agreements.find((a) => a.repairRecordId === record.id && a.phase === "pre_repair");
  const post = agreements.find((a) => a.repairRecordId === record.id && a.phase === "post_repair");
  const status = getRepairRecordStatus(record, agreements);
  const checklistLabel = post ? "View Completed Checklists" : pre ? "Continue to Post-Repair Checklist" : "Start Pre-Repair Checklist";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/admin/pos" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to records
        </Link>
        <div className="flex gap-2">
          <PopupLink href={`/admin/pos/${record.id}/checklist`} className="btn-secondary !px-3 !py-1.5 text-xs">
            {checklistLabel}
          </PopupLink>
          <PrintReceiptButton />
        </div>
      </div>

      {status === "pending" && (
        <div className="card border-amber-200 bg-amber-50/60 print:hidden">
          <p className="text-sm font-semibold text-amber-700">⏳ Pending — Pre-Repair checklist saved. Complete the Post-Repair checklist to close this ticket and email the customer&apos;s receipt.</p>
        </div>
      )}

      {record.cancelled && (
        <div className="card border-red-200 bg-red-50/60 print:hidden">
          <p className="text-sm font-semibold text-red-700">✕ This repair was cancelled{record.cancelledAt ? ` on ${formatDateTime(record.cancelledAt)}` : ""}.</p>
          {record.cancellationReason && <p className="mt-1 text-sm text-red-600">{record.cancellationReason}</p>}
        </div>
      )}

      <div className="card space-y-4 print:break-inside-avoid print:border-none print:shadow-none">
        {status === "cancelled" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-red-700">
            Cancelled
          </div>
        )}
        {status === "pending" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pending — Awaiting Post-Repair Checklist
          </div>
        )}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ceejay Cellphone Repair Shop</p>
          <p className="mt-2 font-mono text-lg font-bold text-blue-300">{record.reference}</p>
          <p className="text-xs text-slate-400">{formatDateTime(record.createdAt)}</p>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Branch</span>
            <span className="text-slate-800">{branch?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Customer</span>
            <span className="text-slate-800">{record.customerName}</span>
          </div>
          {record.contactNumber && (
            <div className="flex justify-between text-slate-500">
              <span>Contact</span>
              <span className="text-slate-800">{record.contactNumber}</span>
            </div>
          )}
          {record.email && (
            <div className="flex justify-between text-slate-500">
              <span>Email</span>
              <span className="text-slate-800">{record.email}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Device / Model</span>
            <span className="text-slate-800">{record.deviceModel || "—"}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Technician</span>
            <span className="text-slate-800">{record.technicianName || "—"}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Date of Service</span>
            <span className="text-slate-800">{formatDate(record.serviceDate)}</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 text-sm">
          <div>
            <p className="text-xs font-medium text-slate-400">Reported Problem</p>
            <p className="mt-0.5 whitespace-pre-line text-slate-700">{record.reportedProblem || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Service / Repair Performed</p>
            <p className="mt-0.5 whitespace-pre-line text-slate-700">{record.servicePerformed || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Parts Used</p>
            <p className="mt-0.5 whitespace-pre-line text-slate-700">{record.partsUsed || "—"}</p>
          </div>
          {record.notes && (
            <div>
              <p className="text-xs font-medium text-slate-400">Additional Notes</p>
              <p className="mt-0.5 whitespace-pre-line text-slate-700">{record.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Cost</span>
            <span className="text-slate-800">{peso(record.cost)}</span>
          </div>
          {record.partsCost > 0 && (
            <div className="flex justify-between text-slate-500 print:hidden">
              <span>Parts/Material Cost</span>
              <span className="text-slate-800">−{peso(record.partsCost)}</span>
            </div>
          )}
          {record.laborCost > 0 && (
            <div className="flex justify-between text-slate-500 print:hidden">
              <span>Labor/Service Cost</span>
              <span className="text-slate-800">−{peso(record.laborCost)}</span>
            </div>
          )}
          {record.otherExpenses > 0 && (
            <div className="flex justify-between text-slate-500 print:hidden">
              <span>Other Expenses</span>
              <span className="text-slate-800">−{peso(record.otherExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-slate-900 print:hidden">
            <span>Net Profit</span>
            <span>{peso(record.cost - record.partsCost - record.laborCost - record.otherExpenses)}</span>
          </div>
        </div>
      </div>

      {status === "completed" && (
        <div className="card space-y-2 print:hidden">
          <h3 className="text-sm font-semibold text-slate-800">Receipt</h3>
          <p className="text-xs text-slate-500">If the customer asks for another copy, resend the same PDF receipt to their email.</p>
          <ResendReceiptButton target={{ type: "repairRecord", id: record.id }} email={record.email} />
        </div>
      )}

      {(pre || post) && (
        <div className="hidden space-y-4 print:block">
          {[
            { agreement: pre, title: "Pre-Repair Checklist" },
            { agreement: post, title: "Post-Repair Checklist" },
          ]
            .filter((section): section is { agreement: NonNullable<typeof pre>; title: string } => !!section.agreement)
            .map(({ agreement, title }) => (
              <div key={agreement.id} className="space-y-2 border-t border-slate-200 pt-3 print:break-inside-avoid">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
                  <p className="text-[11px] text-slate-400">Completed {formatDateTime(agreement.completedAt)}</p>
                </div>
                <div className="space-y-1 text-xs">
                  {agreement.items.map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
                      <span className="text-slate-700">
                        {item.label}
                        {item.notes && <span className="text-slate-400"> — {item.notes}</span>}
                      </span>
                      <span className="shrink-0 font-medium text-slate-800">{RESULT_LABEL[item.result ?? ""] ?? "—"}</span>
                    </div>
                  ))}
                </div>
                {agreement.summaryNotes && (
                  <p className="text-xs text-slate-700">
                    <span className="font-medium text-slate-500">Technician Summary: </span>
                    {agreement.summaryNotes}
                  </p>
                )}
                {agreement.warrantyCoverage && (
                  <p className="text-xs text-slate-700">
                    <span className="font-medium text-slate-500">Warranty Coverage: </span>
                    {agreement.warrantyCoverage}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  {agreement.customerSignatureDataUrl && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-slate-500">Customer Signature</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={agreement.customerSignatureDataUrl} alt="Customer signature" className="h-14 w-full border border-slate-200 object-contain" />
                    </div>
                  )}
                  {agreement.technicianSignatureDataUrl && (
                    <div>
                      <p className="mb-1 text-[10px] font-medium text-slate-500">Technician Signature</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={agreement.technicianSignatureDataUrl} alt="Technician signature" className="h-14 w-full border border-slate-200 object-contain" />
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {status !== "cancelled" && (
        <details open={status === "pending"} className="card print:hidden">
          <summary className="cursor-pointer text-sm font-medium text-blue-700">
            {status === "pending" ? "Complete / Edit Customer & Repair Details" : "Edit Customer & Repair Details"}
          </summary>
          <form action={updateRepairRecordDetails} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={record.id} />
            <p className="text-xs text-slate-500">
              {status === "pending"
                ? "Fill in anything that was missing at intake, or fix a detail, before completing the Post-Repair checklist."
                : "Fix any incorrect or missing information — this stays editable even after completion. This won't automatically resend the receipt; use \"Resend Receipt\" above for that."}
              {" "}This is locked once the ticket is cancelled.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Customer Name *</label>
                <input name="customerName" required defaultValue={record.customerName} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Branch *</label>
                <select name="branchId" required defaultValue={record.branchId ?? ""} className="input">
                  <option value="" disabled>
                    Select branch...
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Contact Number</label>
                <input name="contactNumber" defaultValue={record.contactNumber} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input name="email" type="email" defaultValue={record.email} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Device / Model</label>
                <input name="deviceModel" defaultValue={record.deviceModel} className="input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Customer&apos;s Reported Problem</label>
              <textarea name="reportedProblem" rows={2} defaultValue={record.reportedProblem} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Repair / Service Performed</label>
              <textarea name="servicePerformed" rows={2} defaultValue={record.servicePerformed} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Parts Used (if any)</label>
              <input name="partsUsed" defaultValue={record.partsUsed} className="input" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Service / Repair Cost (₱)</label>
                <input name="cost" type="number" min={0} step="0.01" defaultValue={record.cost} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Technician</label>
                <input name="technicianName" defaultValue={record.technicianName} className="input" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500">Expenses (used to calculate net profit on Sales reports)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
                <input name="partsCost" type="number" min={0} step="0.01" defaultValue={record.partsCost} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Labor/Service Cost (₱)</label>
                <input name="laborCost" type="number" min={0} step="0.01" defaultValue={record.laborCost} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Other Expenses (₱)</label>
                <input name="otherExpenses" type="number" min={0} step="0.01" defaultValue={record.otherExpenses} className="input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Date of Service</label>
              <input name="serviceDate" type="date" defaultValue={record.serviceDate} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Additional Notes</label>
              <textarea name="notes" rows={2} defaultValue={record.notes} className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">
              Save Details
            </button>
          </form>
        </details>
      )}

      {!record.cancelled && (
        <details className="card print:hidden">
          <summary className="cursor-pointer text-sm font-medium text-red-600">Cancel this repair</summary>
          <form action={cancelRepairRecord} className="mt-3 space-y-2">
            <input type="hidden" name="id" value={record.id} />
            <p className="text-xs text-slate-500">
              For cases where the repair was unsuccessful and the device couldn&apos;t be fixed. The record stays for history, marked cancelled and left out of revenue totals — nothing is deleted.
            </p>
            <textarea name="reason" rows={2} required className="input" placeholder="Reason — e.g. board damage beyond repair, part unavailable..." />
            <button type="submit" className="btn-secondary !text-red-600">
              Confirm Cancellation
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
