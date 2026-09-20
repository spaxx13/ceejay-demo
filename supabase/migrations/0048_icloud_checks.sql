-- Public paid "iCloud ON/OFF" (Find My iPhone) status checker — a customer
-- pays online (PayMongo, GCash/card) for a one-off SICKW.com lookup on an
-- IMEI/serial. One row per attempt, tracked end-to-end so a payment is
-- never lost track of: created (before checkout) -> payment_pending
-- (checkout session created, customer sent to PayMongo) -> paid (webhook
-- confirmed, or the result page's own fallback re-verification confirmed)
-- -> checked (SICKW call succeeded) or check_failed (paid but the SICKW
-- call didn't come back cleanly - surfaced in Admin > Tools for manual
-- follow-up, since this app has no automated refund flow) -> refund_needed
-- (admin marks this manually; the refund itself still happens in the
-- PayMongo dashboard).
create table icloud_checks (
  id uuid primary key default gen_random_uuid(),
  imei text not null,
  status text not null default 'created'
    check (status in ('created', 'payment_pending', 'paid', 'checked', 'check_failed', 'refund_needed')),
  amount numeric(10,2) not null default 10.00,
  paymongo_checkout_session_id text,
  paymongo_payment_id text,
  paymongo_checkout_url text,
  paid_at timestamptz,
  sickw_raw_response jsonb,
  icloud_status text,
  result_summary text,
  failure_reason text,
  sickw_attempt_count integer not null default 0,
  admin_note text,
  checked_at timestamptz,
  customer_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index icloud_checks_status_idx on icloud_checks (status);
create index icloud_checks_created_at_idx on icloud_checks (created_at desc);
-- Lets session creation be retried safely without ever colliding on a
-- session id that's already attached to a row.
create unique index icloud_checks_paymongo_session_uidx on icloud_checks (paymongo_checkout_session_id) where paymongo_checkout_session_id is not null;
