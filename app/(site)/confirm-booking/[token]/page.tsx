import { redirect } from "next/navigation";
import Link from "next/link";
import { getRequestByConfirmationToken } from "@/lib/db";
import { confirmBooking } from "@/lib/actions";
import { formatDate } from "@/lib/format";

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

export default async function ConfirmBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;

  const req = await getRequestByConfirmationToken(token);

  if (result === "expired") {
    return (
      <Result icon="⏰" title="This link has expired" body="This confirmation window has passed and the booking was automatically cancelled. Please submit a new Home Service Request if you'd still like a technician to visit." />
    );
  }
  if (result === "confirmed" || req?.confirmedAt) {
    return (
      <Result
        icon="✅"
        title="Booking confirmed!"
        body={req ? `Your request ${req.reference} is confirmed and now in queue for a technician to be assigned.` : "Your request is confirmed."}
      />
    );
  }

  if (!req) {
    return <Result icon="⚠️" title="Invalid link" body="We couldn't find a booking for this confirmation link. It may have already been used from a different link, or the link was mistyped." />;
  }

  if (isExpired(req.confirmationExpiresAt)) {
    return (
      <Result icon="⏰" title="This link has expired" body="This confirmation window has passed and the booking was automatically cancelled. Please submit a new Home Service Request if you'd still like a technician to visit." />
    );
  }

  async function confirm() {
    "use server";
    const res = await confirmBooking(token);
    redirect(`/confirm-booking/${token}?result=${res.ok ? "confirmed" : res.error}`);
  }

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="card space-y-4 text-center">
          <p className="text-3xl">📋</p>
          <h1 className="text-lg font-semibold text-slate-800">Confirm Your Booking</h1>
          <div className="space-y-1 text-left text-sm text-slate-600">
            <p>
              <span className="text-slate-400">Reference:</span> <span className="font-mono font-semibold">{req.reference}</span>
            </p>
            <p>
              <span className="text-slate-400">Preferred Date:</span> {req.preferredDatetime ? formatDate(req.preferredDatetime) : "To be confirmed"}
            </p>
          </div>
          <p className="text-sm text-slate-400">
            Confirm below so we can assign a technician to your request. Unconfirmed bookings are automatically cancelled after the
            confirmation window.
          </p>
          <form action={confirm}>
            <button type="submit" className="btn-primary w-full">
              Confirm My Booking
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Result({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="card space-y-3 text-center">
          <p className="text-3xl">{icon}</p>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-400">{body}</p>
          <Link href="/" className="btn-secondary inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
