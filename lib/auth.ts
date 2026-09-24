import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserById } from "./db";
import type { Role, User } from "./types";

const COOKIE = "ceejay_session";
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
// A "don't remember me" login is a browser-session cookie, but the signed
// value still expires server-side so a copied cookie can't live forever.
const SESSION_MS = 12 * 60 * 60 * 1000;

// Signing key for the session cookie. SESSION_SECRET if set (recommended,
// any long random string); otherwise derived from POSTGRES_URL, which is
// already a server-only secret in every environment, so sessions stay
// unforgeable without extra setup.
function sessionKey() {
  const base = process.env.SESSION_SECRET || process.env.POSTGRES_URL;
  if (!base) throw new Error("SESSION_SECRET (or POSTGRES_URL) must be set to sign login sessions");
  return createHmac("sha256", "ceejay-session-v1").update(base).digest();
}

function sign(payload: string) {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

// Cookie value: "<userId>.<expiresAtMs>.<hmac>". Before this, the cookie
// was the bare user id, so anyone who learned an id could log in as that
// user; now it has to carry a signature only the server can produce.
function encodeSession(userId: string, expiresAt: number) {
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(exp) > Date.now())) return null;
  return userId;
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const uid = decodeSession(raw);
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
  const expiresAt = Date.now() + (remember ? REMEMBER_MS : SESSION_MS);
  jar.set(COOKIE, encodeSession(userId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MS / 1000 } : {}),
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
