-- Pickup & Delivery "Phase 5" — Exception Handling (FINAL FLOW spec item
-- 31). One generic table covers every exception kind the spec lists
-- (reschedule, can't-find-customer, flagged damage, rider incident, wrong
-- customer/device, wrong unit completed, payment issue, declined
-- quotation) rather than a bespoke table per kind — each row always
-- records the reason, who reported it, when, and optional photo evidence,
-- same fields the spec requires across all of them. `resolved_at`/
-- `resolved_by` is how admin clears one off the open-issues list.
create table request_exceptions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references home_service_requests(id) on delete cascade,
  kind text not null,
  reason text not null default '',
  evidence_photo_data_url text,
  reported_by text not null,
  reported_by_role text not null,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index request_exceptions_request_id_idx on request_exceptions(request_id);
create index request_exceptions_open_idx on request_exceptions(resolved_at) where resolved_at is null;
