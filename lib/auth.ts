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

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
