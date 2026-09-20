-- Public "Get a Quote" feature (app/(site)/quote) — a customer picks Home
-- Service or Walk-in, adds one or more device/service line items, and gets
-- an emailed PDF quotation with the estimated total. This is a standalone
-- price estimate, not a booking — it never touches home_service_requests,
-- never assigns a technician, and never creates a customer/lead record.

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_name text not null default '',
  phone text not null default '',
  email text not null default '',
  delivery_method text not null check (delivery_method in ('home_service', 'walk_in')),
  branch_id uuid references branches(id) on delete set null,
  province text not null default '',
  city text not null default '',
  service_fee numeric(12,2) not null default 0,
  line_items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  -- null whenever any line item has no price on file — the customer's
  -- estimate is then "confirmed upon inspection" rather than a real total.
  total numeric(12,2),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index quotations_created_idx on quotations (created_at desc);
