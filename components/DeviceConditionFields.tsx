"use client";

import { useState } from "react";
import PhotoUpload from "./PhotoUpload";
import { PICKUP_CONDITION_TEMPLATE, type PickupConditionKey, type PickupConditionResult } from "@/lib/types";

// Same Pass / Fail / N/A badges as the Home Service ChecklistForm — the
// rider's intake inspection should read exactly like the technician's.
const RESULT_OPTIONS: { value: PickupConditionResult; label: string; activeClass: string }[] = [
  { value: "pass", label: "Pass", activeClass: "border-green-200 bg-green-50 text-green-700" },
  { value: "fail", label: "Fail", activeClass: "border-red-200 bg-red-50 text-red-700" },
  { value: "na", label: "N/A", activeClass: "border-blue-300 bg-blue-50 text-blue-700" },
];

const PHOTO_SLOTS = [
  { key: "front", label: "Front", required: true },
  { key: "back", label: "Back", required: true },
  { key: "left", label: "Left Side", required: true },
  { key: "right", label: "Right Side", required: true },
  { key: "top", label: "Top", required: true },
  { key: "bottom", label: "Bottom", required: true },
  { key: "damage", label: "Damaged Area(s) (if any)", required: false },
];

// Rendered inside RiderStatusUpdateForm when the rider picks "Picked Up" —
// the device-condition checklist (PICKUP_CONDITION_TEMPLATE, a copy of the
// Home Service pre-repair checklist rows, stored separately) and the labeled
// proof-of-pickup photos the FINAL FLOW spec requires before a unit can be
// taken from the customer. Field names (condition_<key>,
// condition_notes_<key>, photo_<slot>) match what riderUpdatePickupStatus's
// "picked_up" case reads back out of the FormData.
//
// Results ride in hidden inputs driven by React state (rather than native
// radios) so a failed submission can't visually uncheck them — see the
// note in ChecklistForm.tsx about React resetting native form state.
export default function DeviceConditionFields() {
  const [results, setResults] = useState<Partial<Record<PickupConditionKey, PickupConditionResult>>>({});
  const answered = PICKUP_CONDITION_TEMPLATE.filter((i) => results[i.key]).length;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-700">Device Condition Checklist — at Pickup</p>
        <p className="text-[11px] text-slate-400">
          Document the device&apos;s condition before it leaves the customer — this protects the customer, you, and the shop.{" "}
          {answered}/{PICKUP_CONDITION_TEMPLATE.length} marked.
        </p>
      </div>
      <div className="space-y-2">
        {PICKUP_CONDITION_TEMPLATE.map((item) => (
          <div key={item.key} className="rounded-lg border border-slate-200 p-2.5">
            <input type="hidden" name={`condition_${item.key}`} value={results[item.key] ?? ""} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.helpText}</p>
              </div>
              <div className="flex gap-1.5">
                {RESULT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setResults((r) => ({ ...r, [item.key]: opt.value }))}
                    className={`badge border ${results[item.key] === opt.value ? opt.activeClass : "border-slate-300 bg-slate-100 text-slate-500"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <input name={`condition_notes_${item.key}`} className="input mt-2 !py-1.5 text-sm" placeholder="Notes (optional) — specific issues, observations..." />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Rider&apos;s Pickup Notes/Summary</label>
        <textarea name="existingDamageNotes" rows={2} className="input" placeholder="Overall summary of the device's condition at pickup..." />
      </div>
      <p className="pt-1 text-xs font-semibold text-slate-700">Required Photos</p>
      {PHOTO_SLOTS.map((slot) => (
        <PhotoUpload key={slot.key} name={`photo_${slot.key}`} label={slot.label} required={slot.required} />
      ))}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-medium text-slate-500">Security Seal # (optional)</label>
        <input name="securitySeal" className="input" placeholder="e.g. Seal #004829" />
        <p className="text-[11px] text-slate-400">If you sealed the package, write the seal number here so the shop can verify it on arrival.</p>
      </div>
    </div>
  );
}
