import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionValue } from "@/lib/auth";
import { getUserAuthByEmail, query } from "@/lib/db";

// Native staff-app login — same credential check as loginAction
// (lib/actions.ts:133) but returns the signed session value as JSON
// instead of redirecting, so the iOS apps can keep it in the Keychain and
// send it back as a `Cookie: ceejay_session=...` header. Everything
// downstream (getCurrentUser, the wrapped actions, the existing
// /api/technician|rider/location routes) then works unchanged. Mobile
// logins always get the 30-day "remember" expiry — there's no browser
// session to scope a shorter one to. Customer-facing roles are refused;
// this endpoint exists only for the Technician and Rider apps.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  const user = await getUserAuthByEmail(email);
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }
  if (user.role !== "technician" && user.role !== "rider") {
    return NextResponse.json({ ok: false, error: "This app is for technician and rider accounts only." }, { status: 403 });
  }

  await query("insert into login_logs (user_id, user_name, user_email, role) values ($1,$2,$3,$4)", [user.id, user.name, user.email, user.role]);

  const session = createSessionValue(user.id, true);
  return NextResponse.json({
    ok: true,
    session,
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
