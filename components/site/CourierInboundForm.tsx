"use client";

import { useActionState } from "react";
import { submitCourierInboundTracking } from "@/lib/actions";
import { COURIER_OPTIONS, SELF_BOOK_COURIER_OPTIONS } from "@/lib/courierService";
import type { CourierDeliveryMode } from "@/lib/types";

// "I've shipped it" — lets the customer tell the branch which courier and
// tracking number their device is on, while the request is still awaiting it.
// In self-book mode (Lalamove / Grab) it takes the booking link or number and
// the driver's plate number instead.
export default function CourierInboundForm({ reference, phone, mode = "courier" }: { reference: string; phone: string; mode?: CourierDeliveryMode }) {
  const [state, formAction, pending] = useActionState(submitCourierInboundTracking, undefined);
  const selfBook = mode === "self_book";
  if (state?.ok) {
    return <p className="text-sm text-green-700">{selfBook ? "Thanks! We’ll watch for your driver." : "Thanks! We’ll watch for your parcel."}</p>;
  }
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="phone" value={phone} />
      <select name="courier" required defaultValue="" className="input">
        <option value="" disabled>
          {selfBook ? "Lalamove or Grab" : "Courier"}
        </option>
        {(selfBook ? SELF_BOOK_COURIER_OPTIONS : COURIER_OPTIONS).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="trackingNumber" required className="input" placeholder={selfBook ? "Tracking link or booking number" : "Tracking / waybill number"} />
      {selfBook && <input name="plate" required className="input" placeholder="Driver's plate number" />}
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : selfBook ? "Send Booking Details" : "Send Shipment Details"}
      </button>
    </form>
  );
}
