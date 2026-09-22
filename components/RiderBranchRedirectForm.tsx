"use client";

import { useActionState } from "react";
import type { RiderStatusResult } from "@/lib/actions";

type Branch = { id: string; name: string };

// Small standalone control shown only while a pickup leg is actively "On
// The Way to Branch" — lets the rider redirect to a different branch
// mid-trip without touching the main status dropdown (which only accepts
// the destination once, the first time that step is marked).
export default function RiderBranchRedirectForm({
  action,
  requestId,
  branches,
  currentBranchId,
}: {
  action: (prev: RiderStatusResult | undefined, formData: FormData) => Promise<RiderStatusResult>;
  requestId: string;
  branches: Branch[];
  currentBranchId: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="text-[11px] font-semibold text-blue-700">Heading somewhere else? Redirect the trip:</label>
      <div className="flex gap-1.5">
        <select name="deliveredBranchId" defaultValue={currentBranchId ?? ""} className="input !py-1.5 text-xs">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs">
          {pending ? "..." : "Change"}
        </button>
      </div>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
