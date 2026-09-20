-- Mail-In Repairs: customers far from any branch ship their phone to us by
-- courier. Same shape as walkin_requests (own reference, own status
-- pipeline), plus the shipping legs (customer -> shop, shop -> customer),
-- receiving-condition notes/photos, the final cost, and a PayMongo QR Ph
-- payment taken after the repair (no down payment).
insert into lookups (kind, label, order_num, active)
select 'mailin_status', v.label, v.order_num, true
from (values
  ('Awaiting Shipment', 0),
  ('In Transit', 1),
  ('Received', 2),
  ('Repairing', 3),
  ('Awaiting Payment', 4),
  ('Paid', 5),
  ('Shipped Back', 6),
  ('Delivered', 7),
  ('Cancelled', 8)
) as v(label, order_num)
where not exists (select 1 from lookups where kind = 'mailin_status' and label = v.label);

create table mailin_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  -- Unguessable key for the customer's public tracking page (no login).
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  phone text not null default '',
  email text not null default '',
  branch_id uuid references branches(id),
  device_brand_id uuid references lookups(id),
  device_model_id uuid references device_models(id),
  device_other text not null default '',
  service_type_id uuid references lookups(id),
  issue_description text not null default '',
  photo_data_url text,
  -- Where the repaired phone gets sent back to.
  return_street text not null default '',
  return_barangay text not null default '',
  return_city text not null default '',
  return_province text not null default '',
  return_landmark text not null default '',
  -- Customer -> shop leg.
  outbound_courier text not null default '',
  outbound_tracking text not null default '',
  outbound_shipped_at timestamptz,
  -- Receiving at the shop.
  received_at timestamptz,
  received_by text not null default '',
  received_condition_notes text not null default '',
  received_photo_data_urls jsonb not null default '[]'::jsonb,
  diagnosis text not null default '',
  -- Cost / payment.
  final_cost numeric(10,2),
  repair_completed_at timestamptz,
  qr_payment_status text not null default 'none' check (qr_payment_status in ('none','pending','paid')),
  qr_payment_amount numeric(10,2),
  paymongo_checkout_session_id text,
  paymongo_checkout_url text,
  paymongo_payment_id text,
  paid_at timestamptz,
  paid_method text not null default '',
  repair_record_id uuid references repair_records(id) on delete set null,
  -- Shop -> customer leg.
  return_courier text not null default '',
  return_tracking text not null default '',
  return_shipped_at timestamptz,
  delivered_at timestamptz,
  status_id uuid not null references lookups(id),
  cancelled_reason text not null default '',
  created_at timestamptz not null default now()
);
create index mailin_requests_status_idx on mailin_requests (status_id);
create index mailin_requests_branch_idx on mailin_requests (branch_id);
