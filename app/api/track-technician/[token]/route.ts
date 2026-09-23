import { NextRequest, NextResponse } from "next/server";
import { getTrackingSnapshot } from "@/lib/trackingSnapshot";

// Polled every few seconds by the customer's tracking page
// (components/TechnicianTrackingView.tsx). Public — the unguessable token
// from the customer's "on the way" email is the only credential.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await getTrackingSnapshot(token);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
