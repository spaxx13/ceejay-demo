-- Splits Home Service Requests into two independent queues by service area
-- (Metro Manila/Laguna/Batangas/Quezon vs Other Provinces), each visible
-- only to the branch admin(s) assigned to that queue's backend branch.
--
-- home_service_queue on branches marks the (address-less) backend branches
-- used purely as queue buckets — 'near' or 'far', null for every real branch.
-- queue_branch_id on home_service_requests is set once at submission time
-- from the customer's chosen area and never changes afterwards — distinct
-- from branch_id, which keeps meaning "the assigned technician's actual
-- branch" for revenue attribution, so this doesn't disturb that.

alter table branches add column if not exists home_service_queue text;
alter table home_service_requests add column if not exists queue_branch_id uuid references branches(id) on delete set null;
create index if not exists hsr_queue_branch_idx on home_service_requests (queue_branch_id);
