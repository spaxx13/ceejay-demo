"use client";

import { useActionState, useState } from "react";
import { createAgreementPriceAdmin } from "@/lib/actions";

// Counterpart to EditAgreementPriceAdminForm.tsx for a job that has no
// post-repair record yet (e.g. its status was advanced by hand without
// ever completing the technician's Post-Repair checklist) — lets an
// owner/branch admin record the repair price directly from the request's
// own detail page instead of leaving it unpriced forever.
export default function AddAgreementPriceAdminForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(createAgreementPriceAdmin, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-blue-700 hover:underline">
        Set Repair Price
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Repair Price (₱)</label>
          <input name="cost" type="number" min={0} step="0.01" required className="input" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
          <input name="partsCost" type="number" min={0} step="0.01" className="input" />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">No Post-Repair checklist is on file for this job — this records the price directly.</p>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1 text-xs">
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !px-3 !py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
