import { NextRequest, NextResponse } from "next/server";
import { deleteRequestUpdate, postRequestUpdate } from "@/lib/actions";
import { getLookups, getRequestUpdateById, getRequestUpdates, getServiceAgreementsForRequest, pickupDeliveryStage } from "@/lib/db";
import { requireAssignedPickupDeliveryJob } from "@/lib/mobileStaff";
import { getSignedMediaUrl, UPDATES_BUCKET } from "@/lib/storage";
import type { RequestUpdateMedia } from "@/lib/types";

// "Repair Updates" for a Pickup & Delivery job at the shop — the native
// mirror of app/technician/requests/[id]/updates/page.tsx. GET returns the
// posted updates (media as short-lived signed URLs, like RequestUpdatesList)
// plus the page's "What's next" step; POST wraps postRequestUpdate (media
// already uploaded through ./upload-url); DELETE wraps deleteRequestUpdate.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;
  const { user, request } = gate;

  const [updates, lookups, agreements] = await Promise.all([getRequestUpdates(id), getLookups(), getServiceAgreementsForRequest(id)]);
  const statuses = lookups.filter((l) => l.kind === "request_status");
  const statusLabel = statuses.find((s) => s.id === request.statusId)?.label;

  const resolved = await Promise.all(
    updates.map(async (u) => ({
      id: u.id,
      body: u.body,
      postedBy: u.postedBy || "Ceejay",
      createdAt: u.createdAt,
      canDelete: u.postedByUserId === user.id,
      media: await Promise.all(u.media.map(async (m) => ({ kind: m.kind, url: await getSignedMediaUrl(m.path, UPDATES_BUCKET) }))),
    })),
  );

  return NextResponse.json(
    {
      ok: true,
      job: {
        id: request.id,
        reference: request.reference,
        customerName: request.customerName,
        deviceLabel: request.deviceOther || "Device",
        receivedAtShopAt: request.receivedAtShopAt,
      },
      updates: resolved,
      next: {
        stage: pickupDeliveryStage(request, statusLabel),
        inProgress: statusLabel === "In Progress",
        inProgressStatusId: statuses.find((s) => s.label === "In Progress")?.id ?? null,
        hasPreAgreement: agreements.some((a) => a.phase === "pre_repair"),
        hasPostAgreement: agreements.some((a) => a.phase === "post_repair"),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body : "";
  const media: RequestUpdateMedia[] = Array.isArray(body?.media) ? body.media : [];
  const result = await postRequestUpdate(id, text, media);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;

  const updateId = req.nextUrl.searchParams.get("updateId") ?? "";
  const update = updateId ? await getRequestUpdateById(updateId) : null;
  // deleteRequestUpdate silently refuses anything but the technician's own
  // post — check first so the app gets a real message.
  if (!update || update.requestId !== id) return NextResponse.json({ ok: false, error: "Update not found." }, { status: 404 });
  if (update.postedByUserId !== gate.user.id) return NextResponse.json({ ok: false, error: "You can only delete your own updates." }, { status: 403 });

  const fd = new FormData();
  fd.set("id", updateId);
  await deleteRequestUpdate(fd);
  return NextResponse.json({ ok: true });
}
