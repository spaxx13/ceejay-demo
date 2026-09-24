"use client";

import { useState, useTransition } from "react";
import { setRiderOnDuty } from "@/lib/actions";

// Big, unmissable toggle at the top of the rider's My Jobs page — "I'm on
// shift and can take jobs" vs "I'm off shift". This is what the public
// booking form actually checks before promising a customer a rider is
// available, so a rider going off duty without flipping this leaves stale
// jobs unassignable to them but doesn't block new bookings from finding
// someone else who's on.
export default function RiderOnDutyToggle({ initialOnDuty }: { initialOnDuty: boolean }) {
  const [onDuty, setOnDuty] = useState(initialOnDuty);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !onDuty;
    setOnDuty(next); // optimistic — flip back if the action fails
    startTransition(async () => {
      const fd = new FormData();
      fd.set("onDuty", String(next));
      try {
        await setRiderOnDuty(fd);
      } catch {
        setOnDuty(!next);
      }
    });
  }

  return (
    <div className={`card flex items-center justify-between gap-3 border-2 ${onDuty ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
      <div>
        <p className={`text-sm font-semibold ${onDuty ? "text-green-800" : "text-slate-700"}`}>
          {onDuty ? "🟢 On Duty" : "⚪ Off Duty"}
        </p>
        <p className="text-xs text-slate-500">
          {onDuty ? "You're visible as available for new pickup/delivery bookings." : "Go on duty to be counted as available for new bookings."}
        </p>
      </div>
      <button type="button" onClick={toggle} disabled={pending} className={onDuty ? "btn-secondary shrink-0" : "btn-primary shrink-0"}>
        {onDuty ? "Go Off Duty" : "Go On Duty"}
      </button>
    </div>
  );
}
