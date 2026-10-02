import { NextRequest, NextResponse } from "next/server";
import { createRequestUpdateUploadUrl } from "@/lib/actions";
import { requireAssignedPickupDeliveryJob } from "@/lib/mobileStaff";

// A signed Supabase Storage upload URL for one repair-update photo or
// video — wraps createRequestUpdateUploadUrl. The app PUTs the file
// straight to Storage, then posts the returned path with the update.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const result = await createRequestUpdateUploadUrl(id, contentType);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
