"use client";

import { useActionState } from "react";
import { checkEmailStatus } from "@/lib/actions";

export default function EmailStatusCheck() {
  const [state, formAction, pending] = useActionState(checkEmailStatus, undefined);

  return (
    <form action={formAction} className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">Email (Resend)</p>
          <p className="text-xs text-slate-400">Receipts, quotations, tracking links, and OTP codes.</p>
        </div>
        <button type="submit" disabled={pending} className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs">
          {pending ? "Checking..." : "Check status"}
        </button>
      </div>
      {state?.ok && (
        <p className={`text-xs ${state.verified ? "text-green-700" : "text-amber-700"}`}>
          {state.verified ? "✓" : "⚠"} {state.domain} — {state.status}
          {!state.verified && " — not verified, emails likely aren't reaching customers."}
        </p>
      )}
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
