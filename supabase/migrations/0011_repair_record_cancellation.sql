-- Lets a repair record be marked cancelled (e.g. the repair turned out to
-- be unsuccessful and the device couldn't be fixed) without deleting it —
-- the record and its checklists stay for history, just flagged and
-- excluded from revenue totals.

alter table repair_records add column if not exists cancelled boolean not null default false;
alter table repair_records add column if not exists cancellation_reason text not null default '';
alter table repair_records add column if not exists cancelled_at timestamptz;
