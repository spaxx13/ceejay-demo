-- Courier Service requests move to Trash (like walk-ins) instead of being
-- deleted outright: deleted_at is set when trashed, null again on restore.
alter table courier_requests add column if not exists deleted_at timestamptz;
