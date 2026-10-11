"use client";

import { useActionState } from "react";
import { submitCourierPaymentProof } from "@/lib/actions";
import { COURIER_PAYMENT_METHODS } from "@/lib/courierService";
import PhotoUpload from "@/components/PhotoUpload";

// Proof of payment: the customer pays by GCash or bank transfer, then
// uploads a screenshot of the receipt here for staff to verify.
export default function CourierPaymentForm({ reference, phone, uploaded }: { reference: string; phone: string; uploaded: boolean }) {
  const [state, formAction, pending] = useActionState(submitCourierPaymentProof, undefined);
  if (state?.ok) return <p className="text-sm text-green-700">Salamat! We&apos;ll verify your payment and ship your device back.</p>;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="phone" value={phone} />
      <select name="method" required defaultValue="" className="input">
        <option value="" disabled>
          Paid via
        </option>
        {COURIER_PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input name="paymentReference" className="input" placeholder="Reference no. on the receipt (optional)" />
      <PhotoUpload name="proofDataUrl" label="Screenshot of your payment receipt" required />
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Uploading..." : uploaded ? "Upload a New Proof" : "Send Proof of Payment"}
      </button>
    </form>
  );
}
