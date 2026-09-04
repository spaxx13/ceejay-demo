-- Home service request OTP verification moves from email to SMS (phone) —
-- the otp_codes table already stores exactly what's needed (a hashed code,
-- attempts, expiry), just keyed on the wrong identifier. OTP codes are
-- always short-lived and disposable, so renaming in place (rather than
-- migrating old rows) loses nothing of value.
alter table otp_codes rename column email to phone;

-- Tracks whether an appointment reminder SMS has already gone out for this
-- request, so a daily cron job never sends the same customer two reminders
-- for the same preferred date.
alter table home_service_requests add column if not exists reminder_sent_at timestamptz;
