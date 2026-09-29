"use client";

import { useActionState, useState } from "react";
import { updateAgreementPriceAdmin } from "@/lib/actions";

// Admin-side counterpart to EditAgreementPriceForm.tsx (the technician's
// own, MAX_PRICE_EDITS-capped self-correction tool) — this one is
// uncapped, for an owner/branch admin fixing a mistake directly from the
// request's own detail page. Same two editable fields (Repair Price,
// Parts/Material Cost); the Service Fee is shown read-only since it's
// always derived from the customer's own booking (requestServiceFee),
// never freely typed.
export default function EditAgreementPriceAdminForm({
  agreementId,
  cost,
  laborCost,
  partsCost,
}: {
  agreementId: string;
  cost: number;
  laborCost: number;
  partsCost: number;
}) {
  const [state, formAction, pending] = useActionState(updateAgreementPriceAdmin, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-blue-700 hover:underline">
        Edit Repair Price / Parts Cost
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Repair Price (₱)</label>
          <input name="cost" type="number" min={0} step="0.01" defaultValue={cost} required className="input" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
          <input name="partsCost" type="number" min={0} step="0.01" defaultValue={partsCost} className="input" />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Service Fee: ₱{laborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — set from the customer&apos;s
        booking, not editable here.
      </p>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1 text-xs">
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !px-3 !py-1 text-xs">
          Cancel
        </button>
        {state?.ok && <span className="text-[11px] text-green-700">✓ Saved</span>}
      </div>
    </form>
  );
}
