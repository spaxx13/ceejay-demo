"use client";

import { useActionState, useState } from "react";
import { updateAgreementPrice } from "@/lib/actions";

export default function EditAgreementPriceForm({
  agreementId,
  cost,
  laborCost,
  partsCost,
  editsRemaining,
}: {
  agreementId: string;
  cost: number;
  laborCost: number;
  partsCost: number;
  editsRemaining: number;
}) {
  const [state, formAction, pending] = useActionState(updateAgreementPrice, undefined);
  const [open, setOpen] = useState(false);

  if (editsRemaining <= 0) {
    return <p className="text-[11px] text-slate-400">No price edits remaining for this job.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-blue-700 hover:underline">
        Edit price ({editsRemaining} edit{editsRemaining === 1 ? "" : "s"} left)
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Repair Price (₱)</label>
          <input name="cost" type="number" min={0} step="0.01" defaultValue={cost} required className="input" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Labor/Service Cost (₱)</label>
          <input name="laborCost" type="number" min={0} step="0.01" defaultValue={laborCost} className="input" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Parts/Material Cost (₱)</label>
          <input name="partsCost" type="number" min={0} step="0.01" defaultValue={partsCost} className="input" />
        </div>
      </div>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1 text-xs">
          {pending ? "Saving..." : "Save Price"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !px-3 !py-1 text-xs">
          Cancel
        </button>
        <span className="text-[11px] text-slate-400">
          {editsRemaining} edit{editsRemaining === 1 ? "" : "s"} left, including this one
        </span>
      </div>
    </form>
  );
}
