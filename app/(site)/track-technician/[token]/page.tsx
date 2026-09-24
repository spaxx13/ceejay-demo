import { notFound } from "next/navigation";
import { getTrackingSnapshot } from "@/lib/trackingSnapshot";
import TechnicianTrackingView from "@/components/TechnicianTrackingView";

export const metadata = {
  title: "Track your technician",
  robots: { index: false },
};

// Customer-facing live map, linked from the "Your technician is on the
// way" email sent when the request's status becomes En Route.
export default async function TrackTechnicianPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await getTrackingSnapshot(token);
  if (!snapshot) notFound();

  return (
    <main className="grid-bg px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-center">
          <p className="kicker">Home Service · {snapshot.reference}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Track your technician</h1>
        </div>
        <TechnicianTrackingView pollUrl={`/api/track-technician/${token}`} initial={snapshot} />
      </div>
    </main>
  );
}
