-- Notifications previously pointed at exactly one home_service_requests row
-- (request_id, not-null FK). A notification can now instead point at a
-- walkin_requests row — request_id becomes optional and a parallel
-- walkin_request_id is added, with a check constraint ensuring exactly one
-- of the two is ever set (never both, never neither).
alter table notifications alter column request_id drop not null;
alter table notifications add column walkin_request_id uuid references walkin_requests(id) on delete cascade;
alter table notifications add constraint notifications_one_target_chk check (
  (request_id is not null and walkin_request_id is null) or
  (request_id is null and walkin_request_id is not null)
);
create index if not exists notifications_walkin_idx on notifications (walkin_request_id);
