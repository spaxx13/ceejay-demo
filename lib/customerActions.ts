"use server";

import { redirect } from "next/navigation";
import { query, queryOne, getCustomerByPhone, saveCustomerPushToken } from "./db";
import { setCustomerSession, clearCustomerSession, getCurrentCustomer } from "./customerAuth";
import { normalizePhone, isValidPhone } from "./sms";
import { verifyHomeServiceOtp } from "./actions";

// The phone-OTP send/verify pair is the exact same one the Home Service
// and Pickup & Delivery booking forms already use (lib/actions.ts) — it's
// generic phone verification, not booking-specific, so the customer app's
// login screen calls verifyHomeServiceOtp directly rather than duplicating
// the SMS/otp_codes logic. Sending the code is done from the client via
// that same existing sendHomeServiceOtp action.

// Checked right after the phone number is entered (before sending the
// OTP) purely so the login form knows whether to ask for a name — an
// existing customer's name is already on file, a new one needs to give it
// once to create their account.
export async function customerExistsByPhone(phoneInput: string): Promise<boolean> {
  if (!isValidPhone(phoneInput)) return false;
  const customer = await getCustomerByPhone(normalizePhone(phoneInput));
  return customer !== null;
}

export type CompleteLoginResult = { ok: true } | { ok: false; error: string };

// Called once the OTP has already been verified (verifyHomeServiceOtp
// returned ok) — finds the customer by phone (reusing whatever CRM record
// their past bookings created) or creates a new one, then signs them in.
// A brand-new customer needs a name; a returning one doesn't (already on
// file), so name is optional and only used when creating.
export async function completeCustomerLogin(phoneInput: string, codeInput: string, name: string): Promise<CompleteLoginResult> {
  if (!isValidPhone(phoneInput)) return { ok: false, error: "Enter a valid PH mobile number." };
  const verified = await verifyHomeServiceOtp(phoneInput, codeInput);
  if (!verified.ok) return { ok: false, error: verified.error };

  const phone = normalizePhone(phoneInput);
  const existing = await getCustomerByPhone(phone);
  let customerId = existing?.id;
  if (!customerId) {
    const trimmedName = name.trim();
    if (!trimmedName) return { ok: false, error: "Please enter your name to finish creating your account." };
    const created = await queryOne<{ id: string }>(
      "insert into customers (name, phone, email, street, province, landmark, source) values ($1,$2,'','','','','App Registration') returning id",
      [trimmedName, phone]
    );
    customerId = created!.id;
  }

  await setCustomerSession(customerId);
  await query("delete from otp_codes where phone=$1", [phone]);
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
