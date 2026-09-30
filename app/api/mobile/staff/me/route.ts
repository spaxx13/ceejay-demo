import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Session check the native staff apps call on launch — validates the
// Keychain-stored cookie value and returns the current user, or 401 so
// the app can drop back to the login screen.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && user.role !== "rider")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      technicianId: user.technicianId,
      riderId: user.riderId,
    },
  });
}
