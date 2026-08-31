-- Email OTP verification, gating submission of the public Home Service
-- Request form (anti-spam — only people who control the email address they
-- typed can actually submit). One row per email; a new send overwrites the
-- previous code rather than accumulating history.

create table otp_codes (
  email text primary key,
  code_hash text not null,
  attempts integer not null default 0,
  verified boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table otp_codes enable row level security;
