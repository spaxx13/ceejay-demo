-- Lets staff record which branch handled a repair ticket. Nullable since
-- existing records predate this field.

alter table repair_records add column if not exists branch_id uuid references branches(id) on delete set null;
