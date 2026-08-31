-- Ceejay Cellphone Repair Shop — initial schema
-- Mirrors lib/types.ts. Applied directly against the linked Supabase
-- project (no local Supabase CLI stack — see README for how this was run).

create extension if not exists pgcrypto;

create type role as enum ('owner_admin','branch_admin','technician');
create type employment_status as enum ('full_time','part_time','contractor');
create type lookup_kind as enum ('lead_status','request_status','service_type','customer_source','device_brand','inventory_category');
create type custom_field_type as enum ('text','textarea','select','checkbox','date','datetime');
create type system_field_key as enum ('name','phone','email','device_brand','device_model','service_type','issue','photo','street','city','province','landmark','datetime');
create type stock_movement_type as enum ('in','out','adjustment');
create type sale_line_kind as enum ('inventory','service');
create type payment_method as enum ('cash','card','gcash');
create type activity_entity_type as enum ('customer','lead','home_service_request');
create type checklist_phase as enum ('pre_repair','post_repair');
create type checklist_result as enum ('pass','fail','na');
create type notification_type as enum ('request_in_progress','checklist_completed');

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  contact_number text not null default '',
  active boolean not null default true
);

create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  province text not null default '',
  notes text not null default '',
  active boolean not null default true,
  round_robin_cursor integer not null default 0
);

create table technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_number text not null default '',
  email text not null default '',
  employment_status employment_status not null default 'full_time',
  branch_ids uuid[] not null default '{}',
  zone_ids uuid[] not null default '{}',
  active boolean not null default true
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role role not null,
  technician_id uuid references technicians(id) on delete set null,
  active boolean not null default true
);

create table lookups (
  id uuid primary key default gen_random_uuid(),
  kind lookup_kind not null,
  label text not null,
  order_num integer not null default 0,
  active boolean not null default true
);
create index lookups_kind_idx on lookups (kind);

create table device_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references lookups(id) on delete cascade,
  name text not null,
  active boolean not null default true
);
create index device_models_brand_idx on device_models (brand_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  street text not null default '',
  zone_id uuid references zones(id) on delete set null,
  province text not null default '',
  landmark text not null default '',
  source text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index customers_phone_idx on customers (phone);

create table leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  phone text not null default '',
  email text not null default '',
  source text not null default '',
  status_id uuid not null references lookups(id),
  assigned_to uuid references users(id) on delete set null,
  follow_up_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index leads_status_idx on leads (status_id);

create table home_service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null default '',
  phone text not null default '',
  email text not null default '',
  device_brand_id uuid references lookups(id) on delete set null,
  device_model_id uuid references device_models(id) on delete set null,
  device_other text not null default '',
  service_type_id uuid references lookups(id),
  issue_description text not null default '',
  photo_data_url text,
  street text not null default '',
  landmark text not null default '',
  province text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  zone_id uuid references zones(id) on delete set null,
  unzoned boolean not null default false,
  preferred_datetime date,
  status_id uuid not null references lookups(id),
  assigned_technician_id uuid references technicians(id) on delete set null,
  auto_assigned boolean not null default false,
  branch_id uuid references branches(id) on delete set null,
  admin_notes text not null default '',
  status_history jsonb not null default '[]',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index hsr_status_idx on home_service_requests (status_id);
create index hsr_technician_idx on home_service_requests (assigned_technician_id);
create index hsr_zone_idx on home_service_requests (zone_id);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type activity_entity_type not null,
  entity_id uuid not null,
  message text not null,
  actor text not null default 'System',
  at timestamptz not null default now()
);
create index activity_entity_idx on activity_log (entity_type, entity_id);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null default '',
  name text not null,
  category_id uuid references lookups(id) on delete set null,
  branch_id uuid not null references branches(id) on delete cascade,
  quantity_on_hand integer not null default 0,
  reorder_level integer not null default 0,
  unit_cost numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  active boolean not null default true
);
create index inventory_branch_idx on inventory_items (branch_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  branch_id uuid not null references branches(id),
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  home_service_request_id uuid references home_service_requests(id) on delete set null,
  discount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method payment_method not null default 'cash',
  cashier_name text not null default '',
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  branch_id uuid not null references branches(id),
  type stock_movement_type not null,
  quantity integer not null,
  reason text not null default '',
  reference_sale_id uuid references sales(id) on delete set null,
  actor text not null default '',
  at timestamptz not null default now()
);
create index stock_movements_item_idx on stock_movements (item_id);

create table sale_line_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  kind sale_line_kind not null,
  item_id uuid references inventory_items(id) on delete set null,
  description text not null default '',
  quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0
);
create index sale_line_items_sale_idx on sale_line_items (sale_id);

create table site_content (
  id smallint primary key default 1 check (id = 1),
  hero_kicker text not null default '',
  hero_headline_prefix text not null default '',
  hero_headline_highlight text not null default '',
  hero_headline_suffix text not null default '',
  hero_subtext text not null default '',
  primary_cta_label text not null default '',
  secondary_cta_label text not null default '',
  cta_banner_title text not null default '',
  cta_banner_subtitle text not null default '',
  cta_banner_button_label text not null default ''
);

create table request_form_content (
  id smallint primary key default 1 check (id = 1),
  page_kicker text not null default '',
  page_title text not null default '',
  page_subtitle text not null default '',
  submit_button_label text not null default '',
  success_title text not null default '',
  success_body text not null default ''
);

create table custom_form_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  system_key system_field_key,
  label text not null,
  placeholder text not null default '',
  type custom_field_type not null default 'text',
  required boolean not null default false,
  options text[] not null default '{}',
  order_num integer not null default 0,
  active boolean not null default true
);

create table service_agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references home_service_requests(id) on delete cascade,
  phase checklist_phase not null,
  reference text not null,
  customer_name text not null default '',
  device_label text not null default '',
  branch_id uuid references branches(id) on delete set null,
  technician_id uuid references technicians(id) on delete set null,
  technician_name text not null default '',
  items jsonb not null default '[]',
  summary_notes text not null default '',
  agreed_to_terms boolean not null default false,
  customer_signature_data_url text,
  technician_signature_data_url text,
  receipt_photo_data_url text,
  completed_at timestamptz not null default now(),
  sent_to_customer_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, phase)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type notification_type not null,
  request_id uuid not null references home_service_requests(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_read_idx on notifications (read_at);

-- Defense in depth: this app talks to Postgres directly as the `postgres`
-- role (bypasses RLS as table owner/superuser) and never uses the
-- PostgREST Data API, but every table in `public` is RLS-enabled with no
-- policies so anon/authenticated (if ever granted Data API access) get
-- nothing by default.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
