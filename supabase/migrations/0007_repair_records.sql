-- POS is being simplified from a checkout system (branch, payment method,
-- itemized inventory pricing) into a flat repair-record log — the shop just
-- wants to record who came in, what was wrong, what was done, and how much
-- it cost. This table replaces `sales`/`sale_line_items` for that purpose;
-- those tables are left in place (unused going forward) rather than dropped,
-- since dropping would lose real historical data for no benefit.

create table repair_records (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null default '',
  contact_number text not null default '',
  device_model text not null default '',
  reported_problem text not null default '',
  service_performed text not null default '',
  parts_used text not null default '',
  cost numeric(12,2) not null default 0,
  technician_name text not null default '',
  service_date date not null default current_date,
  notes text not null default '',
  logged_by text not null default '',
  created_at timestamptz not null default now()
);
create index repair_records_customer_idx on repair_records (customer_id);
