import { NextRequest, NextResponse } from "next/server";
import { createUnboxingUploadUrl } from "@/lib/actions";
import { requireAssignedPickupDeliveryJob } from "@/lib/mobileStaff";

// A signed Supabase Storage upload URL for the unboxing video — wraps
// createUnboxingUploadUrl. The app PUTs the file straight to Storage, then
// attaches it with POST ../ { action: "save", path, contentType }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAssignedPickupDeliveryJob(id);
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const result = await createUnboxingUploadUrl(id, contentType);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
