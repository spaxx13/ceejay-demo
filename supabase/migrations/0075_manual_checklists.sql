alter type activity_entity_type add value if not exists 'manual_checklist';

-- Ad-hoc device checklist + receipt, filled out directly by an admin or
-- technician for a customer who isn't otherwise in the system yet (no
-- online booking, no POS sale) — e.g. a quick device-condition record and
-- printable/emailable proof of drop-off. Deliberately standalone (no FK to
-- home_service_requests/repair_records) and has no pricing fields — that's
-- what POS > New Repair Record is for; this is the lighter-weight tool.
create table if not exists manual_checklists (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  branch_id uuid references branches(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,
  created_by_name text not null default '',
  customer_name text not null,
  customer_phone text not null default '',
  device_label text not null,
  items jsonb not null default '[]',
  summary_notes text not null default '',
  customer_signature_data_url text,
  staff_signature_data_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists manual_checklists_branch_idx on manual_checklists (branch_id);
create index if not exists manual_checklists_created_by_idx on manual_checklists (created_by_user_id);
create index if not exists manual_checklists_created_at_idx on manual_checklists (created_at desc);
