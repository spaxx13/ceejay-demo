-- Splits the one-shot Manual Checklist into a Pre/Post-Repair pair, same
-- shape as ServiceAgreement for POS/home-service jobs — a manual_checklists
-- row is now one phase of a manual_repair_records "ticket", mirroring
-- RepairRecord + ServiceAgreement. The customer/device/branch/creator
-- fields that used to live directly on manual_checklists move up to the
-- new parent table, since they belong to the ticket, not to one phase of it.

create table if not exists manual_repair_records (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  branch_id uuid references branches(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,
  created_by_name text not null default '',
  customer_name text not null,
  customer_phone text not null default '',
  customer_email text not null default '',
  device_label text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists manual_repair_records_branch_idx on manual_repair_records (branch_id);
create index if not exists manual_repair_records_created_by_idx on manual_repair_records (created_by_user_id);
create index if not exists manual_repair_records_created_at_idx on manual_repair_records (created_at desc);

-- One-time backfill: every pre-existing manual_checklists row (the old
-- one-shot shape) becomes its own manual_repair_records parent, before the
-- old customer/device columns are dropped below. Guarded so re-running
-- this file is a no-op once manual_record_id exists.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'manual_checklists' and column_name = 'manual_record_id') then
    insert into manual_repair_records (id, reference, branch_id, created_by_user_id, created_by_name, customer_name, customer_phone, device_label, created_at, deleted_at)
      select gen_random_uuid(), reference, branch_id, created_by_user_id, created_by_name, customer_name, customer_phone, device_label, created_at, deleted_at
      from manual_checklists;
  end if;
end $$;

alter table manual_checklists add column if not exists manual_record_id uuid references manual_repair_records(id) on delete cascade;
alter table manual_checklists add column if not exists phase checklist_phase;
alter table manual_checklists add column if not exists agreed_to_terms boolean not null default false;
alter table manual_checklists add column if not exists warranty_coverage text not null default '';
alter table manual_checklists add column if not exists receipt_photo_data_url text;
alter table manual_checklists add column if not exists completed_at timestamptz;
alter table manual_checklists add column if not exists sent_to_customer_at timestamptz;

-- Backfills manual_record_id/phase for pre-existing rows by matching on the
-- reference they shared 1:1 with their now-split-off parent — every old row
-- was a completed one-shot record, so it becomes a completed post-repair phase.
update manual_checklists mc
  set manual_record_id = mr.id, phase = 'post_repair', agreed_to_terms = true, completed_at = mc.created_at
  from manual_repair_records mr
  where mc.manual_record_id is null and mc.reference = mr.reference;

alter table manual_checklists alter column manual_record_id set not null;
alter table manual_checklists alter column phase set not null;

alter table manual_checklists drop column if exists reference;
alter table manual_checklists drop column if exists branch_id;
alter table manual_checklists drop column if exists created_by_user_id;
alter table manual_checklists drop column if exists created_by_name;
alter table manual_checklists drop column if exists customer_name;
alter table manual_checklists drop column if exists customer_phone;
alter table manual_checklists drop column if exists device_label;
alter table manual_checklists drop column if exists deleted_at;

do $$ begin
  alter table manual_checklists add constraint manual_checklists_record_phase_key unique (manual_record_id, phase);
exception when duplicate_object then null;
end $$;

drop index if exists manual_checklists_branch_idx;
drop index if exists manual_checklists_created_by_idx;
create index if not exists manual_checklists_record_idx on manual_checklists (manual_record_id);
