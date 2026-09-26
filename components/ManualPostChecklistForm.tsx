"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitManualChecklist } from "@/lib/actions";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import SignaturePad from "./SignaturePad";
import PhotoUpload from "./PhotoUpload";
import type { ChecklistResult } from "@/lib/types";

const RESULT_OPTIONS: { value: ChecklistResult; label: string; activeClass: string }[] = [
  { value: "pass", label: "Pass", activeClass: "border-green-200 bg-green-50 text-green-700" },
  { value: "fail", label: "Fail", activeClass: "border-red-200 bg-red-50 text-red-700" },
  { value: "na", label: "N/A", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
];

// The Post-Repair half of a Manual Repair Record — same structure as
// ChecklistForm.tsx's post_repair branch (terms, warranty, pricing,
// signatures, optional receipt photo).
export default function ManualPostChecklistForm({
  manualRecordId,
  reference,
  customerName,
  customerPhone,
  customerEmail,
  deviceLabel,
  backHref,
}: {
  manualRecordId: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deviceLabel: string;
  backHref: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [state, formAction, pending] = useActionState(submitManualChecklist, undefined);
  const [results, setResults] = useState<Record<string, ChecklistResult>>(() =>
    Object.fromEntries(CHECKLIST_TEMPLATE.map((i) => [i.key, null]))
  );
  const [agreed, setAgreed] = useState(false);
  const [warrantyCoverage, setWarrantyCoverage] = useState("");
  const [cost, setCost] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const totalAmount = (Number(cost) || 0) + (Number(laborCost) || 0);

  const allAnswered = CHECKLIST_TEMPLATE.every((i) => results[i.key]);
  const canSubmit = allAnswered && agreed && warrantyCoverage.trim() && cost;

  useEffect(() => {
    if (wasPending.current && !pending && formRef.current) {
      const form = formRef.current;
      for (const item of CHECKLIST_TEMPLATE) {
        const val = results[item.key];
        if (!val) continue;
        const radio = form.querySelector<HTMLInputElement>(`input[name="result_${item.key}"][value="${val}"]`);
        if (radio) radio.checked = true;
      }
      const checkbox = form.querySelector<HTMLInputElement>('input[name="agreedToTerms"]');
      if (checkbox) checkbox.checked = agreed;
    }
    wasPending.current = pending;
  }, [pending, results, agreed]);

  if (state?.ok) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">Post-repair checklist completed</h2>
        <p className="text-sm text-slate-400">
          Both checklists are saved.{" "}
          {customerEmail ? <>A receipt was emailed to <span className="text-slate-600">{customerEmail}</span>.</> : "No email on file — no receipt was sent."}
        </p>
        <button onClick={() => router.push(backHref)} className="btn-primary">
          Back
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="manualRecordId" value={manualRecordId} />
      <input type="hidden" name="phase" value="post_repair" />

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Ceejay Cellphone Repair Shop — Service Agreement</h3>
        <p className="text-xs text-slate-400">Post-Repair Checklist — {reference}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-sm">
          <dt className="text-slate-400">Customer</dt>
          <dd className="text-slate-800">{customerName}</dd>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-800">{customerPhone || customerEmail || "—"}</dd>
          <dt className="text-slate-400">Device</dt>
          <dd className="text-slate-800">{deviceLabel}</dd>
        </dl>
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">II. Post-Repair Checklist</h3>
          <p className="text-xs text-slate-400">Thoroughly check each item after the repair is completed and mark the appropriate result.</p>
        </div>
        <div className="space-y-3">
          {CHECKLIST_TEMPLATE.map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-400">{item.helpText}</p>
                </div>
                <div className="flex gap-1.5">
                  {RESULT_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`badge cursor-pointer border ${
                        results[item.key] === opt.value ? opt.activeClass : "border-slate-300 bg-slate-100 text-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`result_${item.key}`}
                        value={opt.value ?? ""}
                        checked={results[item.key] === opt.value}
                        onChange={() => setResults((r) => ({ ...r, [item.key]: opt.value }))}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <input
                name={`notes_${item.key}`}
                className="input mt-2 !py-1.5 text-sm"
                placeholder="Notes (optional) — specific issues, observations..."
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Post-Repair Notes/Summary</h3>
        <textarea name="summaryNotes" rows={3} className="input" placeholder="Overall summary of the repair and inspection..." />
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">III. Terms and Conditions</h3>
        <p className="text-xs text-slate-400">Please read and understand the following terms and conditions before signing.</p>
        <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-500">
          {SERVICE_AGREEMENT_TERMS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Customer Acknowledgement</h3>
          <p className="mt-1 text-xs text-slate-500">
            I have thoroughly inspected my device and confirm that it is in satisfactory working condition and free from any new damage after
            the repair. I have also read, understood, and agree to the terms and conditions stated above.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="agreedToTerms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          The customer agrees to the terms and conditions above.
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SignaturePad name="customerSignature" label="Customer Signature" />
          <SignaturePad name="staffSignature" label="Staff Signature" />
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Warranty Coverage</h3>
        <p className="text-xs text-slate-500">What warranty applies to this specific repair — this is included on the customer&apos;s emailed receipt.</p>
        <textarea
          name="warrantyCoverage"
          rows={2}
          required
          value={warrantyCoverage}
          onChange={(e) => setWarrantyCoverage(e.target.value)}
          className="input"
          placeholder="e.g. 3-day warranty on LCD replacement for ghost touch/non-responsive issues only"
        />
      </div>

      <div className="card space-y-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Repair Price</h3>
          <p className="text-xs text-slate-500">The base repair price — combined with the Labor/Service Cost below for the total charged to the customer.</p>
          <input
            name="cost"
            type="number"
            min={0}
            step="0.01"
            required
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="input"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Expenses</h3>
          <p className="text-xs text-slate-500">
            Parts/Material Cost and Other Expenses are internal-only — tracked for net profit on the Sales reports, never shown to the customer
            or included on the receipt. Labor/Service Cost is added to the Repair Price as the customer-facing total.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
              <input name="partsCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Labor/Service Cost (₱)</label>
              <input
                name="laborCost"
                type="number"
                min={0}
                step="0.01"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Other Expenses (₱)</label>
              <input name="otherExpenses" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2">
          <span className="text-sm font-semibold text-blue-900">Total Amount (Repair Price + Labor/Service Cost)</span>
          <span className="text-lg font-bold text-blue-900">
            ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Receipt</h3>
        <p className="text-xs text-slate-500">Attach a photo of the receipt, if there is one — optional.</p>
        <PhotoUpload name="receiptPhotoDataUrl" label="Photo of Receipt" />
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending || !canSubmit} className="btn-primary w-full">
        {pending ? "Saving..." : "Complete Checklist & Email Receipt"}
      </button>
      {!canSubmit && (
        <p className="text-center text-xs text-slate-400">
          {!allAnswered
            ? "Mark every checklist item to continue."
            : !agreed
              ? "Check the customer acknowledgement to continue."
              : !warrantyCoverage.trim()
                ? "Enter the warranty coverage for this repair to continue."
                : "Enter the repair price to continue."}
        </p>
      )}
    </form>
  );
}
