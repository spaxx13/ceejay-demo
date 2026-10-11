-- Courier Service: a mail-in repair for customers outside the Home Service
-- and Pickup & Delivery areas, anywhere in the Philippines. The customer
-- ships the device to a branch by courier, the branch repairs it and ships
-- it back. Its own table (like walkin_requests) rather than another
-- fulfillment_mode on home_service_requests — there are no riders,
-- technician visits, map pins or distance fees here, so it doesn't share
-- that table's machinery. The customer pays courier fees both ways: the
-- inbound shipment straight to the courier, the return shipping fee as
-- part of the final amount before the branch ships the device back.
create table courier_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null default '',
  -- Where the repaired device is shipped back to.
  street text not null default '',
  barangay text not null default '',
  city text not null default '',
  province text not null default '',
  zip_code text not null default '',
  landmark text not null default '',
  -- The branch the customer ships the device to.
  branch_id uuid references branches(id),
  device_brand_id uuid references lookups(id),
  device_model_id uuid references device_models(id),
  device_other text not null default '',
  service_type_id uuid references lookups(id),
  issue_description text not null default '',
  photo_data_url text,
  status text not null default 'awaiting_unit',
  -- Customer -> branch shipment (tracking number entered by the customer or staff).
  inbound_courier text not null default '',
  inbound_tracking text not null default '',
  received_at timestamptz,
  -- Final amounts, set by staff once the repair is done.
  repair_cost numeric,
  return_shipping_fee numeric,
  paid_at timestamptz,
  -- Branch -> customer shipment.
  outbound_courier text not null default '',
  outbound_tracking text not null default '',
  shipped_at timestamptz,
  delivered_at timestamptz,
  admin_notes text not null default '',
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint courier_requests_status_check check (
    status in ('awaiting_unit','received','in_repair','ready_to_ship','shipped','delivered','cancelled')
  )
);
create index courier_requests_status_idx on courier_requests (status);
create index courier_requests_branch_idx on courier_requests (branch_id);
