"use client";

import { useActionState } from "react";
import { confirmCourierReceived } from "@/lib/actions";

// "Natanggap ko na" — the customer confirms the repaired device arrived,
// which marks the request Delivered without staff checking the courier.
export default function CourierReceivedForm({ reference, phone }: { reference: string; phone: string }) {
  const [state, formAction, pending] = useActionState(confirmCourierReceived, undefined);
  if (state?.ok) return <p className="text-sm text-green-700">Salamat! Enjoy your repaired device.</p>;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="phone" value={phone} />
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : "Natanggap ko na ang device ko"}
      </button>
    </form>
  );
}
