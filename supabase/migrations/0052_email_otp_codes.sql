-- Email-based OTP verification — an anti-spam gate for the Walk-In
-- Registration form (public, no phone-based OTP like Home Service Requests
-- uses), so a customer must prove they control the email address they typed
-- before the form can be submitted. Mirrors otp_codes (phone-based, Home
-- Service) but keyed by email and generates its own 6-digit code (sent via
-- Resend) instead of Semaphore's dedicated OTP route, since Resend is
-- plain transactional email with no such feature.
create table email_otp_codes (
  email text primary key,
  code_hash text not null,
  attempts integer not null default 0,
  verified boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
