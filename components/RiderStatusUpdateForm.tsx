"use client";

import { useState } from "react";
import SignaturePad from "./SignaturePad";

type Option = { value: string; label: string; needsSignature?: boolean };

// A single "update status" dropdown per job leg, instead of one button per
// step — the rider picks the status directly. The signature pad only shows
// up when the chosen status is one that needs it (picked up / delivered).
export default function RiderStatusUpdateForm({
  action,
  requestId,
  options,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  requestId: string;
  options: Option[];
  defaultValue: string;
}) {
  const [status, setStatus] = useState(defaultValue);
  const selected = options.find((o) => o.value === status);

  return (
    <form action={action} className="space-y-3 border-t border-slate-200 pt-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Update status</label>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {selected?.needsSignature && <SignaturePad name="signatureDataUrl" label="Customer Signature (optional)" />}
      <button type="submit" className="btn-primary w-full">
        Update
      </button>
    </form>
  );
}
