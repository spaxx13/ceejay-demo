"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createRepairRecordDraft } from "@/lib/actions";
import { CHECKLIST_TEMPLATE } from "@/lib/checklist";
import SignaturePad from "./SignaturePad";
import PopupLink from "./PopupLink";
import type { ChecklistResult } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

const RESULT_OPTIONS: { value: ChecklistResult; label: string; activeClass: string }[] = [
  { value: "pass", label: "Pass", activeClass: "border-green-200 bg-green-50 text-green-700" },
  { value: "fail", label: "Fail", activeClass: "border-red-200 bg-red-50 text-red-700" },
  { value: "na", label: "N/A", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
];

function ChecklistItems({
  prefix,
  results,
  onChange,
}: {
  prefix: "pre";
  results: Record<string, ChecklistResult>;
  onChange: (key: string, value: ChecklistResult) => void;
}) {
  return (
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
                    name={`${prefix}_result_${item.key}`}
                    value={opt.value ?? ""}
                    checked={results[item.key] === opt.value}
                    onChange={() => onChange(item.key, opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <input
            name={`${prefix}_notes_${item.key}`}
            className="input mt-2 !py-1.5 text-sm"
            placeholder="Notes (optional) — specific issues, observations..."
          />
        </div>
      ))}
    </div>
  );
}

export default function NewRepairRecordForm({
  branches,
  technicians,
}: {
  branches: { id: string; name: string }[];
  technicians: { name: string; branchIds: string[] }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [state, formAction, pending] = useActionState(createRepairRecordDraft, undefined);

  const [branchId, setBranchId] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [showOtherTechnician, setShowOtherTechnician] = useState(false);
  const availableTechnicians = technicians.filter((t) => branchId && t.branchIds.includes(branchId));

  const [preResults, setPreResults] = useState<Record<string, ChecklistResult>>(() =>
    Object.fromEntries(CHECKLIST_TEMPLATE.map((i) => [i.key, null]))
  );

  const preAllAnswered = CHECKLIST_TEMPLATE.every((i) => preResults[i.key]);
  const canSubmit = preAllAnswered;

  // Same React 19 quirk as ChecklistForm: a <form action> resets native DOM
  // checked state after every settled submission, desyncing it from React
  // state. Re-assert after a failed submit so nothing has to be redone.
  useEffect(() => {
    if (wasPending.current && !pending && formRef.current) {
      const form = formRef.current;
      for (const item of CHECKLIST_TEMPLATE) {
        const val = preResults[item.key];
        if (!val) continue;
        const radio = form.querySelector<HTMLInputElement>(`input[name="pre_result_${item.key}"][value="${val}"]`);
        if (radio) radio.checked = true;
      }
    }
    wasPending.current = pending;
  }, [pending, preResults]);

  // This form is meant to be opened as a separate pop-up window (see the
  // "+ New Record" button on the list page) so an operator can have several
  // tickets open at once. Once saved, refresh whichever window opened this
  // one so its list picks up the new pending ticket right away.
  useEffect(() => {
    if (state?.ok && window.opener) {
      try {
        window.opener.location.reload();
      } catch {
        // opener may be cross-origin or already closed — ignore
      }
    }
  }, [state]);

  if (state?.ok) {
    const hasOpener = typeof window !== "undefined" && !!window.opener;
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">Ticket saved — pending post-repair</h2>
        <p className="text-sm text-slate-400">
          Reference: <span className="font-mono text-blue-300">{state.reference}</span>
        </p>
        <p className="text-xs text-slate-400">
          The Pre-Repair checklist was saved with this record. It&apos;s now on the pending list — come back to it any time to finish the
          Post-Repair checklist and send the customer&apos;s receipt.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <PopupLink href={`/admin/pos/${state.recordId}/checklist`} className="btn-primary">
            Continue to Post-Repair →
          </PopupLink>
          <PopupLink href={`/admin/pos/${state.recordId}`} className="btn-secondary">
            View Ticket
          </PopupLink>
          {hasOpener && (
            <button type="button" onClick={() => window.close()} className="btn-secondary">
              Close Window
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mx-auto max-w-2xl space-y-6">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Customer &amp; Repair Info</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Customer Name *</label>
            <input name="customerName" required className="input" placeholder="Juan Dela Cruz" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Branch *</label>
            <select
              name="branchId"
              required
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setTechnicianName("");
                setShowOtherTechnician(false);
              }}
              className="input"
            >
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
            <input name="contactNumber" className="input" placeholder="0917 123 4567" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Email</label>
            <input name="email" type="email" className="input" placeholder="juan@email.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Device / Model</label>
            <input name="deviceModel" className="input" placeholder="e.g. iPhone 14, Samsung Galaxy S24" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Customer&apos;s Reported Problem</label>
          <textarea name="reportedProblem" rows={2} className="input" placeholder="e.g. Cracked screen, battery drains fast" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Repair / Service Performed</label>
          <textarea name="servicePerformed" rows={2} className="input" placeholder="e.g. Replaced screen assembly and battery" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Parts Used (if any)</label>
          <input name="partsUsed" className="input" placeholder="e.g. iPhone 14 screen assembly, battery" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Service / Repair Cost (₱)</label>
            <input name="cost" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Technician</label>
            {showOtherTechnician ? (
              <input
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="input"
                placeholder="Type technician's name"
                autoFocus
              />
            ) : (
              <select
                value={technicianName}
                onChange={(e) => {
                  if (e.target.value === "__other__") {
                    setShowOtherTechnician(true);
                    setTechnicianName("");
                  } else {
                    setTechnicianName(e.target.value);
                  }
                }}
                disabled={!branchId}
                className="input"
              >
                <option value="">{branchId ? "Select technician..." : "Select a branch first"}</option>
                {availableTechnicians.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
                <option value="__other__">Other — type manually</option>
              </select>
            )}
            {/* The visible control above is a plain <select>/<input> without a
                name so it never submits a literal "__other__" — this hidden
                field carries the actual chosen/typed name for the action. */}
            <input type="hidden" name="technicianName" value={technicianName} />
            {branchId && availableTechnicians.length === 0 && !showOtherTechnician && (
              <p className="text-[11px] text-amber-700">No technicians are assigned to this branch yet — add one in Settings &gt; Technicians, or pick &quot;Other&quot; to type a name.</p>
            )}
          </div>
        </div>

        <p className="text-xs font-medium text-slate-500">Expenses (optional — used to calculate net profit on Sales reports)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
            <input name="partsCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Labor/Service Cost (₱)</label>
            <input name="laborCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Other Expenses (₱)</label>
            <input name="otherExpenses" type="number" min={0} step="0.01" className="input" placeholder="0.00" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Date of Service</label>
          <input name="serviceDate" type="date" defaultValue={today()} className="input" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Additional Notes</label>
          <textarea name="notes" rows={2} className="input" placeholder="Anything else worth noting..." />
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">I. Pre-Repair Checklist</h3>
          <p className="text-xs text-slate-400">Document the device&apos;s condition before any repair work begins.</p>
        </div>
        <ChecklistItems prefix="pre" results={preResults} onChange={(k, v) => setPreResults((r) => ({ ...r, [k]: v }))} />
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Notes/Summary</h3>
        <textarea name="preSummaryNotes" rows={2} className="input" placeholder="Overall summary of the device's condition on intake..." />
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Pre-Repair Customer &amp; Technician Sign-Off</h3>
        <p className="text-xs text-slate-500">Both sign to confirm this is an accurate record of the device&apos;s condition before repair.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SignaturePad name="preCustomerSignature" label="Customer Signature" />
          <SignaturePad name="preTechnicianSignature" label="Technician's Signature" />
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending || !canSubmit} className="btn-primary w-full">
        {pending ? "Saving..." : "Save Ticket (Pending Post-Repair)"}
      </button>
      {!canSubmit && <p className="text-center text-xs text-slate-400">Mark every Pre-Repair checklist item to continue.</p>}
      <p className="text-center text-xs text-slate-400">
        The Post-Repair checklist, customer receipt email, and warranty details are completed separately once the repair is finished.
      </p>
    </form>
  );
}
