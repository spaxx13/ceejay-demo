import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCustomerById } from "./db";
import type { Customer } from "./types";

// Separate from lib/auth.ts (staff/admin sessions) on purpose — a customer
// account and a staff account are different trust boundaries, so they get
// their own cookie and their own signing salt (a forged/leaked customer
// session token can never be replayed as a staff session, even though both
// ultimately derive from the same server secret).
const COOKIE = "ceejay_customer_session";
// Customers log in with a phone OTP, not a password — there's no
// "remember me" checkbox to weigh, so every login just gets a long-lived
// session; re-verifying by SMS every few hours would be poor UX for an app
// people open to check on a repair.
const SESSION_MS = 90 * 24 * 60 * 60 * 1000;

function sessionKey() {
  const base = process.env.SESSION_SECRET || process.env.POSTGRES_URL;
  if (!base) throw new Error("SESSION_SECRET (or POSTGRES_URL) must be set to sign login sessions");
  return createHmac("sha256", "ceejay-customer-session-v1").update(base).digest();
}

function sign(payload: string) {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

function encodeSession(customerId: string, expiresAt: number) {
  const payload = `${customerId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [customerId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${customerId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(exp) > Date.now())) return null;
  return customerId;
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const id = decodeSession(raw);
  if (!id) return null;
  return getCustomerById(id);
}

export async function setCustomerSession(customerId: string) {
  const jar = await cookies();
  const expiresAt = Date.now() + SESSION_MS;
  jar.set(COOKIE, encodeSession(customerId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearCustomerSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
