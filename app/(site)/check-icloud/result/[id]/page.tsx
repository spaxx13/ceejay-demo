import Link from "next/link";
import { getIcloudCheckById } from "@/lib/db";
import { processIcloudCheckPayment } from "@/lib/paymentProcessing";
import { retrieveCheckoutSession } from "@/lib/paymongo";

// Never trusts anything from the URL/query string beyond the opaque check
// id — every state shown here comes from the DB row, or (as a fallback,
// keyed by the session id WE stored, never one from the client) a direct
// server-to-PayMongo lookup. See lib/actions.ts's processIcloudCheckPayment
// and lib/db.ts's claimIcloudCheckAsPaid for why this is safe to call from
// here even if the webhook races it.
export default async function CheckIcloudResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let check = await getIcloudCheckById(id);

  if (!check) {
    return <Result icon="⚠️" title="Invalid link" body="We couldn't find a check for this link. It may have been mistyped." />;
  }

  if (check.status === "created" || check.status === "payment_pending") {
    if (check.paymongoCheckoutSessionId) {
      try {
        const session = await retrieveCheckoutSession(check.paymongoCheckoutSessionId);
        if (session.paid && session.paymentId) {
          check = (await processIcloudCheckPayment(check.id, session.paymentId)) ?? check;
        }
      } catch {
        // PayMongo lookup failed — fall through and show the still-pending
        // state below; the webhook may still land, or the customer can
        // retry the resume link.
      }
    }
  }

  if (check.status === "created" || check.status === "payment_pending") {
    return (
      <Result icon="⏳" title="Payment not completed yet" body="We haven't received confirmation of your payment. If you already paid, this can take a moment — refresh this page in a bit.">
        {check.paymongoCheckoutUrl && (
          <a href={check.paymongoCheckoutUrl} className="btn-primary inline-block">
            Resume Payment
          </a>
        )}
      </Result>
    );
  }

  if (check.status === "paid") {
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <meta httpEquiv="refresh" content="4" />
        <div className="mx-auto max-w-md">
          <div className="card space-y-3 text-center">
            <p className="text-3xl">⏳</p>
            <h1 className="text-lg font-semibold text-slate-800">Processing your check…</h1>
            <p className="text-sm text-slate-400">Payment confirmed — checking the iCloud status now. This page refreshes automatically.</p>
          </div>
        </div>
      </main>
    );
  }

  if (check.status === "checked") {
    const isOn = check.icloudStatus === "ON";
    return (
      <main className="grid-bg px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="card space-y-3 text-center">
            <p className="text-3xl">{isOn ? "🔒" : "🔓"}</p>
            <h1 className="text-lg font-semibold text-slate-800">
              Find My iPhone is <span className={isOn ? "text-red-600" : "text-green-700"}>{check.icloudStatus}</span>
            </h1>
            <p className="text-sm text-slate-600">{check.resultSummary}</p>
            <p className="font-mono text-xs text-slate-400">IMEI/Serial: {check.imei}</p>
            <p className="text-xs text-slate-400">
              {isOn
                ? "The device is still linked to an Apple ID. It may get locked when reset unless the previous owner removes it first."
                : "The device is not linked to Find My iPhone — safe from an iCloud activation lock standpoint."}{" "}
              This is informational only.
            </p>
            <Link href="/" className="btn-secondary inline-block">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // check_failed / refund_needed
  return (
    <Result
      icon="❌"
      title="We couldn't complete this check"
      body={
        check.status === "refund_needed"
          ? "Your payment went through but the check couldn't be completed, and a refund is being processed."
          : "Your payment went through but the check couldn't be completed. Please contact us with the reference below so we can help."
      }
    >
      <p className="font-mono text-xs text-slate-400">Reference: {check.id}</p>
    </Result>
  );
}

function Result({ icon, title, body, children }: { icon: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="card space-y-3 text-center">
          <p className="text-3xl">{icon}</p>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-400">{body}</p>
          {children}
          <Link href="/" className="btn-secondary inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
