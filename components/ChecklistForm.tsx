"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitChecklist } from "@/lib/actions";
import SignaturePad from "./SignaturePad";
import PhotoUpload from "./PhotoUpload";
import type { ChecklistPhase, ChecklistResult } from "@/lib/types";

type Item = { key: string; label: string; helpText: string };

const RESULT_OPTIONS: { value: ChecklistResult; label: string; activeClass: string }[] = [
  { value: "pass", label: "Pass", activeClass: "border-green-200 bg-green-50 text-green-700" },
  { value: "fail", label: "Fail", activeClass: "border-red-200 bg-red-50 text-red-700" },
  { value: "na", label: "N/A", activeClass: "border-slate-300 bg-slate-100 text-slate-600" },
];

export default function ChecklistForm({
  phase,
  requestId,
  reference,
  customerName,
  phone,
  email,
  deviceLabel,
  address,
  items,
  terms,
}: {
  phase: ChecklistPhase;
  requestId: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string;
  deviceLabel: string;
  address: string;
  items: Item[];
  terms: string[];
}) {
  const isPost = phase === "post_repair";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [state, formAction, pending] = useActionState(submitChecklist, undefined);
  const [results, setResults] = useState<Record<string, ChecklistResult>>(() => Object.fromEntries(items.map((i) => [i.key, null])));
  const [agreed, setAgreed] = useState(false);

  const allAnswered = items.every((i) => results[i.key]);
  const canSubmit = allAnswered && (!isPost || agreed);

  // React resets a <form action={...}> element's native DOM state (radio
  // "checked", checkbox "checked") after every action settles, success or
  // failure — it doesn't touch our React state, but it does desync the DOM
  // from it, visually unchecking everything. Re-assert the DOM after a
  // failed submission so a technician doesn't have to redo the checklist.
  useEffect(() => {
    if (wasPending.current && !pending && formRef.current) {
      const form = formRef.current;
      for (const item of items) {
        const val = results[item.key];
        if (!val) continue;
        const radio = form.querySelector<HTMLInputElement>(`input[name="result_${item.key}"][value="${val}"]`);
        if (radio) radio.checked = true;
      }
      const checkbox = form.querySelector<HTMLInputElement>('input[name="agreedToTerms"]');
      if (checkbox) checkbox.checked = agreed;
    }
    wasPending.current = pending;
  }, [pending, results, agreed, items]);

  if (state?.ok) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">{isPost ? "Post-repair checklist completed" : "Pre-repair checklist saved"}</h2>
        <p className="text-sm text-slate-400">
          {isPost ? (
            <>
              The job has been marked <span className="text-slate-600">Completed</span>. Both checklists were saved to the system and sent to
              the customer at <span className="text-slate-600">{email || phone}</span>.
            </>
          ) : (
            "The post-repair checklist is now available for this job."
          )}
        </p>
        <button onClick={() => router.push("/technician")} className="btn-primary">
          Back to My Jobs
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="phase" value={phase} />

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Ceejay Apple Services {isPost ? "Service Agreement" : "Intake Inspection"}</h3>
        <p className="text-xs text-slate-400">{isPost ? "Post-Repair Checklist" : "Pre-Repair Checklist"} — {reference}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-sm">
          <dt className="text-slate-400">Customer</dt>
          <dd className="text-slate-800">{customerName}</dd>
          <dt className="text-slate-400">Contact</dt>
          <dd className="text-slate-800">{phone || email || "—"}</dd>
          <dt className="text-slate-400">Device</dt>
          <dd className="text-slate-800">{deviceLabel}</dd>
          <dt className="text-slate-400">Address</dt>
          <dd className="text-slate-800">{address}</dd>
        </dl>
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{isPost ? "II. Post-Repair Checklist" : "I. Pre-Repair Checklist"}</h3>
          <p className="text-xs text-slate-400">
            {isPost
              ? "Thoroughly check each item after the repair is completed and mark the appropriate result."
              : "Document the device's condition before any repair work begins — this protects both the shop and the customer."}
          </p>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
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
        <h3 className="text-sm font-semibold text-slate-800">
          Technician&apos;s {isPost ? "Post-Repair" : "Pre-Repair"} Notes/Summary
        </h3>
        <textarea
          name="summaryNotes"
          rows={3}
          className="input"
          placeholder={isPost ? "Overall summary of the repair and inspection..." : "Overall summary of the device's condition on intake..."}
        />
      </div>

      {isPost && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">III. Terms and Conditions</h3>
          <p className="text-xs text-slate-400">Please read and understand the following terms and conditions before signing.</p>
          <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-500">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="card space-y-4">
        {isPost ? (
          <>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Customer Acknowledgement</h3>
              <p className="mt-1 text-xs text-slate-500">
                I have thoroughly inspected my device and confirm that it is in satisfactory working condition and free from any new damage
                after the repair. I have also read, understood, and agree to the terms and conditions stated above.
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
              <SignaturePad name="technicianSignature" label="Technician's Signature" />
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-slate-800">Customer &amp; Technician Sign-Off</h3>
            <p className="text-xs text-slate-500">Both sign to confirm this is an accurate record of the device&apos;s condition before repair.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SignaturePad name="customerSignature" label="Customer Signature" />
              <SignaturePad name="technicianSignature" label="Technician's Signature" />
            </div>
          </>
        )}
      </div>

      {isPost && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Receipt</h3>
          <p className="text-xs text-slate-500">Attach a photo of the receipt — required to complete and close this case.</p>
          <PhotoUpload name="receiptPhotoDataUrl" label="Photo of Receipt" required />
        </div>
      )}

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending || !canSubmit} className="btn-primary w-full">
        {pending ? "Saving..." : isPost ? "Complete Checklist & Send to Customer" : "Save Pre-Repair Checklist"}
      </button>
      {!canSubmit && (
        <p className="text-center text-xs text-slate-400">
          {!allAnswered ? "Mark every checklist item to continue." : "Check the customer acknowledgement to continue."}
        </p>
      )}
    </form>
  );
}
