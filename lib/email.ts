import "server-only";
import { Resend } from "resend";

// Resend's shared testing sender — works without a verified custom domain.
// Swap for a real "no-reply@yourdomain.com" once a domain is verified in
// the Resend dashboard.
const FROM = "Ceejay Cellphone Repair Shop <onboarding@resend.dev>";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function sendOtpEmail(to: string, code: string) {
  const client = getClient();
  const { error } = await client.emails.send({
    from: FROM,
    to,
    subject: `${code} is your Ceejay verification code`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto;">
        <p>Your verification code for the Ceejay Cellphone Repair Shop home service request is:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${code}</p>
        <p style="color: #667; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}
