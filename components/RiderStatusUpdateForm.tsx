"use client";

import { useActionState, useState } from "react";
import SignaturePad from "./SignaturePad";
import PhotoUpload from "./PhotoUpload";
import type { RiderStatusResult } from "@/lib/actions";

type Option = { value: string; label: string; needsSignature?: boolean; needsPhoto?: boolean; needsBranch?: boolean };
type Branch = { id: string; name: string };

// A single "update status" dropdown per job leg, instead of one button per
// step — the rider picks the status directly. Extra fields (signature,
// proof-of-pickup photo, which branch it was dropped off at) only show up
// once the chosen status actually needs them.
export default function RiderStatusUpdateForm({
  action,
  requestId,
  options,
  defaultValue,
  branches,
  defaultBranchId,
}: {
  action: (prev: RiderStatusResult | undefined, formData: FormData) => Promise<RiderStatusResult>;
  requestId: string;
  options: Option[];
  defaultValue: string;
  branches?: Branch[];
  defaultBranchId?: string;
}) {
  const [status, setStatus] = useState(defaultValue);
  const [state, formAction, pending] = useActionState(action, undefined);
  const selected = options.find((o) => o.value === status);

  return (
    <form action={formAction} className="space-y-3 border-t border-slate-200 pt-3">
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
      {selected?.needsPhoto && <PhotoUpload name="photoDataUrl" label="Photo of the Unit" required />}
      {selected?.needsBranch && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Which Branch <span className="text-red-600">*</span>
          </label>
          <select name="deliveredBranchId" required defaultValue={defaultBranchId ?? ""} className="input">
            <option value="" disabled>
              Select branch...
            </option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {selected?.needsSignature && <SignaturePad name="signatureDataUrl" label="Customer Signature (optional)" />}
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Updating..." : "Update"}
      </button>
    </form>
  );
}
