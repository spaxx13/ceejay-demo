"use client";

import { useActionState } from "react";
import { submitCourierInboundTracking } from "@/lib/actions";
import { COURIER_OPTIONS } from "@/lib/courierService";

// "I've shipped it" — lets the customer tell the branch which courier and
// tracking number their device is on, while the request is still awaiting it.
export default function CourierInboundForm({ reference, phone }: { reference: string; phone: string }) {
  const [state, formAction, pending] = useActionState(submitCourierInboundTracking, undefined);
  if (state?.ok) return <p className="text-sm text-green-700">Thanks! We&apos;ll watch for your parcel.</p>;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="phone" value={phone} />
      <select name="courier" required defaultValue="" className="input">
        <option value="" disabled>
          Courier
        </option>
        {COURIER_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="trackingNumber" required className="input" placeholder="Tracking / waybill number" />
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : "Send Shipment Details"}
      </button>
    </form>
  );
}
