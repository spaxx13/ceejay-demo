-- Pickup & Delivery: a second fulfillment mode for Home Service Requests,
-- staffed by Riders — a role separate from Technicians who only ever handle
-- the pickup/delivery legs, never the repair itself. Kept on the existing
-- home_service_requests table (same reference series, same technician
-- assignment/status machinery for the "at shop" repair leg) rather than a
-- parallel table, since a pickup & delivery job differs from an on-site job
-- only in who couriers it and a handful of extra timestamps — see
-- lib/db.ts's pickupDeliveryStage() for how it all collapses into one
-- display stage.

alter type role add value if not exists 'rider';

create table riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_number text not null default '',
  email text not null default '',
  branch_id uuid references branches(id) on delete set null,
  vehicle text not null default 'motorcycle',
  active boolean not null default true
);

alter table users add column rider_id uuid references riders(id) on delete set null;

alter table home_service_requests
  add column fulfillment_mode text not null default 'on_site',
  add column pickup_rider_id uuid references riders(id) on delete set null,
  add column delivery_rider_id uuid references riders(id) on delete set null,
  add column picked_up_at timestamptz,
  add column out_for_delivery_at timestamptz,
  add column delivered_at timestamptz,
  add column pickup_signature_data_url text,
  add column delivery_signature_data_url text;

alter table home_service_requests
  add constraint hsr_fulfillment_mode_check check (fulfillment_mode in ('on_site','pickup_delivery'));

create index hsr_pickup_rider_idx on home_service_requests (pickup_rider_id);
create index hsr_delivery_rider_idx on home_service_requests (delivery_rider_id);
