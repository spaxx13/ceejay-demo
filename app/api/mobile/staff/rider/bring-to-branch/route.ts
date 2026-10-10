import { NextRequest, NextResponse } from "next/server";
import { riderBringDevicesToBranch } from "@/lib/actions";
import { parseJsonBody } from "@/lib/mobileFormData";

// Batch version of pickup-status's heading_to_shop / delivered_to_branch for a
// rider carrying several devices: { requestIds: string[], step:
// "heading_to_shop" | "delivered_to_branch" }. Runs the same per-device logic
// (riderUpdatePickupStatus in lib/actions.ts) for each one.
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const ids = Array.isArray(body.requestIds) ? body.requestIds.map(String) : [];
  const step = body.step === "delivered_to_branch" ? "delivered_to_branch" : "heading_to_shop";
  const result = await riderBringDevicesToBranch(ids, step);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
