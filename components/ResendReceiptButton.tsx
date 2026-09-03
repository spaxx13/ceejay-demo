"use client";

import { useActionState } from "react";
import { resendReceiptEmail } from "@/lib/actions";

export default function ResendReceiptButton({
  target,
  email,
}: {
  target: { type: "request"; id: string } | { type: "repairRecord"; id: string };
  email: string;
}) {
  const [state, formAction, pending] = useActionState(resendReceiptEmail, undefined);

  if (!email) {
    return <p className="text-xs text-slate-400">No email on file for this customer — can&apos;t resend the receipt.</p>;
  }

  return (
    <form action={formAction} className="space-y-1.5 print:hidden">
      {target.type === "request" ? (
        <input type="hidden" name="requestId" value={target.id} />
      ) : (
        <input type="hidden" name="repairRecordId" value={target.id} />
      )}
      <button type="submit" disabled={pending} className="btn-secondary !px-3 !py-1.5 text-xs">
        {pending ? "Sending..." : "Resend Receipt"}
      </button>
      {state?.ok && <p className="text-xs text-green-700">✓ Receipt resent to {state.email}.</p>}
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
