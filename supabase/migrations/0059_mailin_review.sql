-- Staff review step: a new request lands in "Pending Review" and the
-- customer is only told to ship once staff approves it (optionally with an
-- estimated price / note). order_num -1 sorts it ahead of "Awaiting Shipment".
insert into lookups (kind, label, order_num, active)
select 'mailin_status', 'Pending Review', -1, true
where not exists (select 1 from lookups where kind = 'mailin_status' and label = 'Pending Review');

alter table mailin_requests add column if not exists estimate_note text not null default '';
