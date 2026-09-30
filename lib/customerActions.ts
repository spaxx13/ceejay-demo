"use server";

import { redirect } from "next/navigation";
import { query, queryOne, getCustomerByEmail, saveCustomerPushToken } from "./db";
import { setCustomerSession, clearCustomerSession, getCurrentCustomer } from "./customerAuth";
import { verifyWalkInOtp } from "./actions";

// Customers sign in with an emailed one-time code — no password. The
// send/verify pair is the same email OTP the Walk-In pre-registration form
// already uses (sendWalkInOtp/verifyWalkInOtp in lib/actions.ts, keyed by
// email in email_otp_codes) — generic email verification, not
// walk-in-specific — so the login screen calls it directly rather than
// duplicating the code/hash/expiry logic.

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Checked right after the email is entered (before sending the code)
// purely so the login form knows whether to ask for a name — an existing
// customer's name is already on file, a new one needs to give it once to
// create their account.
export async function customerExistsByEmail(emailInput: string): Promise<boolean> {
  const email = emailInput.trim().toLowerCase();
  if (!isValidEmail(email)) return false;
  return (await getCustomerByEmail(email)) !== null;
}

export type CompleteLoginResult = { ok: true } | { ok: false; error: string };

// Verifies the emailed code, then finds the customer by email (reusing
// whatever CRM record their past bookings created) or creates a new one,
// and signs them in. A brand-new customer needs a name; a returning one
// doesn't (already on file), so name is optional and only used when creating.
export async function completeCustomerLogin(emailInput: string, codeInput: string, name: string): Promise<CompleteLoginResult> {
  const email = emailInput.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const verified = await verifyWalkInOtp(email, codeInput);
  if (!verified.ok) return { ok: false, error: verified.error };

  const existing = await getCustomerByEmail(email);
  let customerId = existing?.id;
  if (!customerId) {
    const trimmedName = name.trim();
    if (!trimmedName) return { ok: false, error: "Please enter your name to finish creating your account." };
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, street, province, landmark, source) values ($1,'',$2,'','','','App Registration') returning id",
      [trimmedName, email]
    );
    customerId = created!.id;
  }

  await setCustomerSession(customerId);
  await query("delete from email_otp_codes where email=$1", [email]);
  return { ok: true };
}

export async function logoutCustomer() {
  await clearCustomerSession();
  redirect("/app-home");
}

export async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/my/login");
  return customer;
}

// Called from the native app once it has an FCM token, so "on the way"
// pushes have somewhere to go. Silently no-ops if the customer signed out
// between requesting permission and this call — nothing to attach the
// token to yet.
export async function registerPushToken(token: string) {
  const customer = await getCurrentCustomer();
  if (!customer) return;
  await saveCustomerPushToken(customer.id, token);
}
