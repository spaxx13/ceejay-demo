-- Customer must confirm a Home Service Request by clicking the link in
-- their quotation email before it's ready for an admin to assign — new
-- requests start in "Pending Confirmation" instead of "Pending" (whenever
-- an email was captured to send that link to). If not confirmed within 2
-- hours, a cron job (see app/api/cron/void-unconfirmed-requests) moves it
-- to "Cancelled" automatically.
insert into lookups (kind, label, order_num, active)
select 'request_status', 'Pending Confirmation', -1, true
where not exists (select 1 from lookups where kind = 'request_status' and label = 'Pending Confirmation');

alter table home_service_requests add column if not exists confirmation_token text unique;
alter table home_service_requests add column if not exists confirmation_expires_at timestamptz;
alter table home_service_requests add column if not exists confirmed_at timestamptz;
create index if not exists hsr_confirmation_token_idx on home_service_requests (confirmation_token);
