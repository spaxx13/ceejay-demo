import { NextRequest, NextResponse } from "next/server";
import { deleteUnboxingVideo, publishUnboxingVideo, saveUnboxingVideo } from "@/lib/actions";
import { getBranches, getRequestById } from "@/lib/db";
import { requireAssignedPickupDeliveryJob } from "@/lib/mobileStaff";
import { getUnboxingVideoUrl } from "@/lib/storage";

// Unboxing Video for a Pickup & Delivery job at the shop — the native mirror
// of app/technician/requests/[id]/unboxing/page.tsx. GET returns the current
// video (signed URL) and its draft/sent state; POST runs one of the page's
// actions: "save" (attach an uploaded file as a draft — saveUnboxingVideo),
// "publish" (Send to Customer), or "delete" (drafts only, for a technician).

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;
  const { request } = gate;

  const [branches, videoUrl] = await Promise.all([getBranches(), getUnboxingVideoUrl(request.unboxingVideoPath)]);
  const branch = branches.find((b) => b.id === request.deliveredBranchId);

  return NextResponse.json(
    {
      ok: true,
      job: {
        id: request.id,
        reference: request.reference,
        customerName: request.customerName,
        deviceLabel: request.deviceOther || "Device",
        branchName: branch?.name ?? null,
        securitySeal: request.pickupSecuritySeal || null,
        receivedAtShopAt: request.receivedAtShopAt,
      },
      video: videoUrl
        ? {
            url: videoUrl,
            recordedBy: request.unboxingVideoRecordedBy,
            recordedAt: request.unboxingVideoRecordedAt,
            publishedAt: request.unboxingVideoPublishedAt,
            // A technician can delete only while it's still a draft.
            canDelete: !request.unboxingVideoPublishedAt,
          }
        : null,
      // Same limits as the web recorder (components/VideoCaptureInput.tsx).
      maxSeconds: 120,
      maxBytes: 45 * 1024 * 1024,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;
  const { request } = gate;

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const fd = new FormData();
  fd.set("id", id);

  switch (action) {
    case "save": {
      const path = typeof body?.path === "string" ? body.path : "";
      const contentType = typeof body?.contentType === "string" ? body.contentType : "";
      const durationSeconds = Number(body?.durationSeconds) || 0;
      const result = await saveUnboxingVideo(id, path, contentType, durationSeconds);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "publish": {
      if (!request.unboxingVideoPath) return NextResponse.json({ ok: false, error: "Record a video first." }, { status: 400 });
      if (request.unboxingVideoPublishedAt) return NextResponse.json({ ok: false, error: "This video was already sent to the customer." }, { status: 400 });
      await publishUnboxingVideo(fd);
      break;
    }
    case "delete": {
      if (!request.unboxingVideoPath) return NextResponse.json({ ok: false, error: "There's no video to delete." }, { status: 400 });
      if (request.unboxingVideoPublishedAt) {
        return NextResponse.json({ ok: false, error: "This video was already sent to the customer — ask an admin to remove it." }, { status: 403 });
      }
      await deleteUnboxingVideo(fd);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  // publish/delete return nothing — confirm the change actually landed.
  const after = await getRequestById(id);
  const landed = action === "publish" ? !!after?.unboxingVideoPublishedAt : !after?.unboxingVideoPath;
  return NextResponse.json(landed ? { ok: true } : { ok: false, error: "Couldn't update the video — please try again." }, { status: landed ? 200 : 500 });
}
