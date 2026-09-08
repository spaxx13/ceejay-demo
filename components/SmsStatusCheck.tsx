"use client";

import { useActionState } from "react";
import { checkSmsStatus } from "@/lib/actions";

export default function SmsStatusCheck() {
  const [state, formAction, pending] = useActionState(checkSmsStatus, undefined);

  return (
    <form action={formAction} className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">SMS (Semaphore)</p>
          <p className="text-xs text-slate-400">OTP codes, request/appointment texts, and daily reminders.</p>
        </div>
        <button type="submit" disabled={pending} className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs">
          {pending ? "Checking..." : "Check status"}
        </button>
      </div>
      {state?.ok && (
        <p className="text-xs text-green-700">
          ✓ {state.status} — {state.accountName} — ₱{state.creditBalance.toFixed(2)} credit balance.
        </p>
      )}
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
