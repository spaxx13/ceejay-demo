"use client";

// Shown on a job card until the rider responds — admin assigning a rider
// doesn't start the trip, the rider still has to Accept (or Decline, which
// clears the assignment back to the unassigned pool for admin to hand to
// someone else). The rest of the job card (location sharing, status
// updates) only renders once accepted — see app/rider/page.tsx.
export default function RiderAcceptDeclineForm({
  requestId,
  onAccept,
  onDecline,
}: {
  requestId: string;
  onAccept: (formData: FormData) => void;
  onDecline: (formData: FormData) => void;
}) {
  return (
    <div className="flex gap-2 border-t border-slate-200 pt-3">
      <form action={onAccept} className="flex-1">
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="btn-primary w-full">
          Accept
        </button>
      </form>
      <form action={onDecline} className="flex-1">
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="btn-secondary w-full">
          Decline
        </button>
      </form>
    </div>
  );
}
