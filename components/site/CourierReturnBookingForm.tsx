"use client";

import { useActionState } from "react";
import { submitCourierReturnBooking } from "@/lib/actions";
import { SELF_BOOK_COURIER_OPTIONS } from "@/lib/courierService";

// Self-book only: once the repair is paid, the customer books their own
// Lalamove / Grab driver for the trip back and tells the branch who is
// coming, so the plate number can be checked before the device is released.
export default function CourierReturnBookingForm({
  reference,
  phone,
  defaultCourier,
  defaultTracking,
}: {
  reference: string;
  phone: string;
  defaultCourier: string;
  defaultTracking: string;
}) {
  const [state, formAction, pending] = useActionState(submitCourierReturnBooking, undefined);
  if (state?.ok) return <p className="text-sm text-green-700">Salamat! Makikita ng branch ang driver mo at ilalabas ang device pagdating niya.</p>;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="phone" value={phone} />
      {defaultTracking && <p className="text-xs text-slate-500">Naka-save na: {defaultCourier} — {defaultTracking}. Maaari mo itong palitan sa baba.</p>}
      <select name="courier" required defaultValue={SELF_BOOK_COURIER_OPTIONS.includes(defaultCourier) ? defaultCourier : ""} className="input">
        <option value="" disabled>
          Lalamove or Grab
        </option>
        {SELF_BOOK_COURIER_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="trackingNumber" required className="input" placeholder="Tracking link or booking number" />
      <input name="plate" required className="input" placeholder="Driver's plate number" />
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : "Send Return Booking Details"}
      </button>
    </form>
  );
}
