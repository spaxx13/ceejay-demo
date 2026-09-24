"use client";

import { useActionState, useState } from "react";
import PhotoUpload from "./PhotoUpload";
import type { ReportExceptionResult } from "@/lib/actions";

// Pickup & Delivery "Phase 5" — Exception Handling (FINAL FLOW spec item
// 31). A rider only sees the kinds they'd plausibly hit in the field;
// admin/branch staff get the rest (cancellation, payment, declined
// quotation) too. Collapsed by default — this is for when something's
// gone wrong, not part of the normal flow.
const RIDER_KINDS = [
  { value: "reschedule", label: "Customer Unavailable (Reschedule)" },
  { value: "contact_attempted", label: "Can't Find Customer" },
  { value: "flag_damage", label: "Additional Damage Found" },
  { value: "incident", label: "Safety Incident" },
  { value: "stop_review", label: "Wrong Customer / Device" },
  { value: "stop_delivery", label: "Wrong Unit — Stop Delivery" },
];
const ADMIN_KINDS = [
  ...RIDER_KINDS,
  { value: "cancel", label: "Cancel Booking" },
  { value: "return_device", label: "Customer Declined Quotation (Return Device)" },
  { value: "payment_hold", label: "Payment Issue (Hold)" },
];

export default function ReportExceptionForm({
  action,
  requestId,
  role,
}: {
  action: (prev: ReportExceptionResult | undefined, formData: FormData) => Promise<ReportExceptionResult>;
  requestId: string;
  role: "rider" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [state, formAction, pending] = useActionState(action, undefined);
  const options = role === "rider" ? RIDER_KINDS : ADMIN_KINDS;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-red-600 hover:underline">
        Report an Issue
      </button>
    );
  }

  if (state?.ok) {
    return <p className="text-xs font-medium text-green-700">Issue reported — admin has been notified.</p>;
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-xs font-semibold text-red-700">Report an Issue</p>
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} required className="input !py-1.5 text-xs">
        <option value="" disabled>
          Select a reason...
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {kind === "reschedule" && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">New Pickup Date/Time</label>
          <input type="datetime-local" name="newPreferredDatetime" className="input !py-1.5 text-xs" />
        </div>
      )}
      <textarea name="reason" required rows={2} className="input text-xs" placeholder="What happened?" />
      <PhotoUpload name="evidencePhotoDataUrl" label="Evidence Photo (optional)" />
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary !py-1.5 text-xs">
          {pending ? "Submitting..." : "Submit"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
