-- Soft-delete support for Home Service Requests and POS Repair Records —
-- "Delete" now moves a row to Trash (deleted_at set) instead of erasing it
-- outright. Every existing read (getRequests/getRepairRecords) filters
-- deleted_at is null, so a trashed row disappears from the normal admin
-- lists, technician board, and sales reports without touching its history.
-- Only the explicit "Delete Permanently" action in Trash removes it from
-- the database for good.
alter table home_service_requests add column if not exists deleted_at timestamptz;
alter table repair_records add column if not exists deleted_at timestamptz;
create index if not exists hsr_deleted_at_idx on home_service_requests (deleted_at);
create index if not exists repair_records_deleted_at_idx on repair_records (deleted_at);
