"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createManualRepairRecord } from "@/lib/actions";
import { CHECKLIST_TEMPLATE } from "@/lib/checklist";
import SignaturePad from "./SignaturePad";
import type { ChecklistResult } from "@/lib/types";

const RESULT_OPTIONS: { value: ChecklistResult; label: string; activeClass: string }[] = [
  { value: "pass", label: "Pass", activeClass: "border-green-200 bg-green-50 text-green-700" },
  { value: "fail", label: "Fail", activeClass: "border-red-200 bg-red-50 text-red-700" },
  { value: "na", label: "N/A", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
];

// A standalone repair ticket for a customer with no online booking or POS
// sale yet — creates the ticket and its Pre-Repair checklist together, same
// split as NewRepairRecordForm.tsx (Post-Repair is finished separately, on
// its own page, once the repair is done).
export default function ManualChecklistForm({
  branches,
  detailHrefBase,
  backHref,
}: {
  branches: { id: string; name: string }[];
  detailHrefBase: string;
  backHref: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [state, formAction, pending] = useActionState(createManualRepairRecord, undefined);
  const [results, setResults] = useState<Record<string, ChecklistResult>>(() =>
    Object.fromEntries(CHECKLIST_TEMPLATE.map((i) => [i.key, null]))
  );

  const allAnswered = CHECKLIST_TEMPLATE.every((i) => results[i.key]);

  // Same DOM-resync-after-a-failed-submission fix as ChecklistForm.tsx —
  // React resets native form state (radio "checked") after every action
  // settles, desyncing it from our React state.
  useEffect(() => {
    if (wasPending.current && !pending && formRef.current) {
      const form = formRef.current;
      for (const item of CHECKLIST_TEMPLATE) {
        const val = results[item.key];
        if (!val) continue;
        const radio = form.querySelector<HTMLInputElement>(`input[name="result_${item.key}"][value="${val}"]`);
        if (radio) radio.checked = true;
      }
    }
    wasPending.current = pending;
  }, [pending, results]);

  if (state?.ok) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">Ticket saved — {state.reference}</h2>
        <p className="text-sm text-slate-400">
          The Pre-Repair checklist was saved. It&apos;s now pending — come back any time to finish the Post-Repair checklist and send the
          customer&apos;s receipt.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`${detailHrefBase}/${state.recordId}/post-checklist`} className="btn-primary">
            Continue to Post-Repair →
          </Link>
          <Link href={`${detailHrefBase}/${state.recordId}`} className="btn-secondary">
            View Ticket
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Customer & Device</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Customer Name *</label>
            <input name="customerName" required className="input" placeholder="Juan Dela Cruz" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Contact Number</label>
            <input name="customerPhone" className="input" placeholder="0917 123 4567" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Email</label>
            <input name="customerEmail" type="email" className="input" placeholder="juan@email.com" />
            <p className="text-[11px] text-slate-400">Set this to email the receipt once the Post-Repair checklist is completed.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Device *</label>
            <input name="deviceLabel" required className="input" placeholder="iPhone 13 Pro" />
          </div>
        </div>
        {branches.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Branch</label>
            <select name="branchId" className="input max-w-xs">
              <option value="">—</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">I. Pre-Repair Checklist</h3>
          <p className="text-xs text-slate-400">Document the device&apos;s condition before any repair work begins.</p>
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
        <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Notes/Summary</h3>
        <textarea name="summaryNotes" rows={3} className="input" placeholder="Overall summary of the device's condition on intake..." />
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Customer &amp; Staff Sign-Off</h3>
        <p className="text-xs text-slate-500">Both sign to confirm this is an accurate record of the device&apos;s condition before repair.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SignaturePad name="customerSignature" label="Customer Signature" />
          <SignaturePad name="staffSignature" label="Staff Signature" />
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending || !allAnswered} className="btn-primary w-full">
        {pending ? "Saving..." : "Save Ticket (Pending Post-Repair)"}
      </button>
      {!allAnswered && <p className="text-center text-xs text-slate-400">Mark every checklist item to continue.</p>}
      <p className="text-center text-xs text-slate-400">
        The Post-Repair checklist and customer receipt email are completed separately once the repair is finished.
      </p>
      <Link href={backHref} className="block text-center text-xs text-slate-400 hover:text-slate-600">
        ← Cancel
      </Link>
    </form>
  );
}
