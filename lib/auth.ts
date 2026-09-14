import "server-only";
import { cookies } from "next/headers";
import { getUserById } from "./db";
import type { Role, User } from "./types";

const COOKIE = "ceejay_session";

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = jar.get(COOKIE)?.value;
  if (!uid) return null;
  const user = await getUserById(uid);
  return user && user.active ? user : null;
}

export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

// remember=true persists the login across browser restarts (30 days);
// remember=false sets a session-only cookie that's gone once the browser
// closes — the "Remember me" checkbox on the login form controls this.
export async function setSession(userId: string, remember: boolean) {
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
