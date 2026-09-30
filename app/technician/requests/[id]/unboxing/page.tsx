import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, getBranches, canManageHomeServiceRequests } from "@/lib/db";
import { getUnboxingVideoUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import UnboxingVideoRecorder from "@/components/UnboxingVideoRecorder";

// Technician-side unboxing page for a Pickup & Delivery job that has
// reached the shop — record (or re-record) the video the customer will
// see on /track. Linked from the technician board's job card.
export default async function TechnicianUnboxingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && !canManageHomeServiceRequests(user))) redirect("/login");

  const { id } = await params;
  const [req, branches] = await Promise.all([getRequestById(id), getBranches()]);
  if (!req || req.fulfillmentMode !== "pickup_delivery") notFound();
  const branch = branches.find((b) => b.id === req.deliveredBranchId);
  const videoUrl = await getUnboxingVideoUrl(req.unboxingVideoPath);

  return (
    <div className="space-y-4">
      <Link href="/technician" className="inline-block text-sm text-slate-400 hover:underline">
        ← Back to My Jobs
      </Link>
      <div>
        <p className="font-mono text-xs text-slate-400">{req.reference}</p>
        <h1 className="text-lg font-bold text-slate-900">Unboxing Video</h1>
        <p className="text-sm text-slate-500">
          {req.customerName} — {req.deviceOther || "Device"}
          {branch ? ` · at ${branch.name}` : ""}
          {req.pickupSecuritySeal ? ` · seal ${req.pickupSecuritySeal}` : ""}
        </p>
      </div>

      {!req.receivedAtShopAt ? (
        <p className="card text-sm text-amber-700">This device hasn&apos;t been marked as received at the shop yet — the rider does that on hand-off.</p>
      ) : (
        <div className="card space-y-4">
          {videoUrl && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Current video</p>
              <video controls playsInline preload="metadata" src={videoUrl} className="w-full rounded-lg border border-slate-200 bg-black" />
              <p className="text-[11px] text-slate-400">
                Recorded by {req.unboxingVideoRecordedBy ?? "—"}
                {req.unboxingVideoRecordedAt ? ` — ${formatDateTime(req.unboxingVideoRecordedAt)}` : ""}. The customer can watch this on their
                tracking page.
              </p>
            </div>
          )}
          <UnboxingVideoRecorder requestId={req.id} existing={!!req.unboxingVideoPath} />
        </div>
      )}
    </div>
  );
}
