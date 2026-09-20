"use client";

import { useActionState } from "react";
import { startIcloudCheck } from "@/lib/actions";

export default function IcloudCheckForm({ pricePesos }: { pricePesos: number }) {
  const [state, formAction, pending] = useActionState(startIcloudCheck, undefined);

  return (
    <form action={formAction} className="card space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          IMEI or Serial Number <span className="text-red-600">*</span>
        </label>
        <input name="imei" required className="input" placeholder="e.g. 358240051111110" autoComplete="off" />
        <p className="text-xs text-slate-400">
          Dial <span className="font-mono">*#06#</span> on the device to see its IMEI, or check Settings → General → About.
        </p>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Starting payment..." : `Pay ₱${pricePesos} & Check`}
      </button>
      <p className="text-center text-xs text-slate-400">Secure payment via GCash or card, powered by PayMongo.</p>
    </form>
  );
}
