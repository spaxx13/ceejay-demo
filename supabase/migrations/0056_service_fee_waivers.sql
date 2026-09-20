-- Tracking record for a waived Home Service visit fee. Created the
-- moment a fee is waived and immediately soft-deleted (deleted_at set to
-- now()) so it lands straight in Trash — there is no "active" list for
-- these, only a Trash tab offering Restore (un-waive) and Delete
-- Permanently (stop tracking; the fee stays waived on the request).
create table service_fee_waivers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references home_service_requests(id),
  queue_branch_id uuid, -- snapshot of the request's queue_branch_id, for the same branch-scoped Trash visibility every other entity there gets
  reference text not null,
  customer_name text not null,
  amount numeric(10,2) not null,
  waived_by text not null default '',
  waived_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index service_fee_waivers_deleted_at_idx on service_fee_waivers (deleted_at);
create index service_fee_waivers_request_id_idx on service_fee_waivers (request_id);
