"use client";

import { useActionState } from "react";
import { sendCrmBroadcast } from "@/lib/actions";

export default function BroadcastForm({ recipientCount }: { recipientCount: number }) {
  const [state, formAction, pending] = useActionState(sendCrmBroadcast, undefined);

  return (
    <form action={formAction} className="card space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500">Subject</label>
        <input name="subject" required placeholder="e.g. 20% off screen repairs this weekend!" className="input" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Message</label>
        <textarea name="message" required rows={8} placeholder="Write your announcement or promo here..." className="input" />
      </div>
      <p className="text-xs text-slate-400">
        Will be emailed to {recipientCount} distinct address{recipientCount === 1 ? "" : "es"} across every lead and customer that has an
        email on file.
      </p>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state && state.ok && (
        <p className="text-sm text-green-700">
          Sent to {state.sent} of {state.total}{state.failed > 0 ? ` (${state.failed} failed)` : ""}.
        </p>
      )}
      <button type="submit" disabled={pending || recipientCount === 0} className="btn-primary w-full">
        {pending ? "Sending..." : `Send to ${recipientCount} people`}
      </button>
    </form>
  );
}
