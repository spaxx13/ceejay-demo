create table walkin_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
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
  preferred_date date,
  status_id uuid not null references lookups(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index walkin_requests_status_idx on walkin_requests (status_id);
create index walkin_requests_branch_idx on walkin_requests (branch_id);
