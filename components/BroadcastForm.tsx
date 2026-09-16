"use client";

import { useState, useActionState } from "react";
import { sendCrmBroadcast } from "@/lib/actions";
import BroadcastPhotoUpload from "@/components/BroadcastPhotoUpload";
import { formatDateTime } from "@/lib/format";

// Local YYYY-MM-DDTHH:mm, one minute ahead of now — the earliest a
// datetime-local "Schedule for later" input can be set to (the field
// itself still needs a manual clock-skew-tolerant re-check server-side).
function minScheduleValue() {
  const d = new Date(Date.now() + 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BroadcastForm({ recipientCount }: { recipientCount: number }) {
  const [state, formAction, pending] = useActionState(sendCrmBroadcast, undefined);
  const [scheduledAt, setScheduledAt] = useState("");
  const isScheduling = scheduledAt.trim() !== "";

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

      <BroadcastPhotoUpload name="photos" />

      <div>
        <label className="text-xs font-medium text-slate-500">Schedule for later (optional)</label>
        <input
          type="datetime-local"
          name="scheduledAt"
          min={minScheduleValue()}
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="input"
        />
        <p className="mt-1 text-xs text-slate-400">
          {isScheduling ? "Leave this blank instead if you want to send right away." : "Leave blank to send immediately."}
        </p>
      </div>

      <p className="text-xs text-slate-400">
        Will be emailed to {recipientCount} distinct address{recipientCount === 1 ? "" : "es"} across every lead and customer that has an
        email on file.
      </p>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state && state.ok && !state.scheduled && (
        <p className="text-sm text-green-700">
          Sent to {state.sent} of {state.total}
          {state.failed > 0 ? ` (${state.failed} failed)` : ""}.
        </p>
      )}
      {state && state.ok && state.scheduled && (
        <p className="text-sm text-green-700">Scheduled for {formatDateTime(state.scheduledAt)} — about {state.total} recipients.</p>
      )}

      <button type="submit" disabled={pending || recipientCount === 0} className="btn-primary w-full">
        {pending ? (isScheduling ? "Scheduling..." : "Sending...") : isScheduling ? `Schedule for ${recipientCount} people` : `Send to ${recipientCount} people`}
      </button>
    </form>
  );
}
