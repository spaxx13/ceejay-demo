import { formatDateTime } from "@/lib/format";
import type { ServiceAgreement } from "@/lib/types";

const RESULT_LABEL: Record<string, string> = { pass: "Pass", fail: "Fail", na: "N/A" };

export default function AgreementSummary({ agreement, title }: { agreement: ServiceAgreement; title: string }) {
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">
          Completed {formatDateTime(agreement.completedAt)}
          {agreement.sentToCustomerAt && " — sent to customer"}
        </p>
      </div>
      <div className="card space-y-3">
        {agreement.items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <div>
              <p className="text-sm text-slate-800">{item.label}</p>
              {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
            </div>
            <span className="badge shrink-0 border border-slate-300 bg-slate-100 text-slate-600">
              {RESULT_LABEL[item.result ?? ""] ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {agreement.summaryNotes && (
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-800">Technician Summary</h3>
          <p className="whitespace-pre-line text-sm text-slate-600">{agreement.summaryNotes}</p>
        </div>
      )}
      {agreement.warrantyCoverage && (
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-800">Warranty Coverage</h3>
          <p className="whitespace-pre-line text-sm text-slate-600">{agreement.warrantyCoverage}</p>
        </div>
      )}
      {agreement.cost > 0 && (
        <div className="card space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Repair Price</h3>
            <p className="text-sm font-semibold text-slate-800">
              ₱{agreement.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          {agreement.laborCost > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Labor/Service Cost</span>
              <span>+₱{agreement.laborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {agreement.laborCost > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-sm font-semibold text-slate-900">
              <span>Total Amount</span>
              <span>₱{(agreement.cost + agreement.laborCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {agreement.partsCost > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Parts/Material Cost</span>
              <span>−₱{agreement.partsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {agreement.otherExpenses > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Other Expenses</span>
              <span>−₱{agreement.otherExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      )}
      <div className={`card grid grid-cols-1 gap-4 ${agreement.customerSignatureDataUrl ? "sm:grid-cols-2" : ""}`}>
        {agreement.customerSignatureDataUrl && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Customer Signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agreement.customerSignatureDataUrl} alt="Customer signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Technician Signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.technicianSignatureDataUrl ?? ""} alt="Technician signature" className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
        </div>
      </div>
      {agreement.receiptPhotoDataUrl && (
        <div className="card space-y-1">
          <p className="text-xs font-medium text-slate-500">Receipt</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agreement.receiptPhotoDataUrl} alt="Receipt" className="max-h-56 rounded-lg border border-slate-200 object-contain" />
        </div>
      )}
    </div>
  );
}
