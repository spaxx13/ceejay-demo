-- Courier Service access gets its own dial, like Pickup & Delivery's
-- can_manage_pickup_delivery: the owner picks exactly which branch admins see
-- Admin > Courier Service (set from Settings > Staff Accounts). Owner admins
-- always have it. Until now access followed can_manage_requests, so existing
-- branch admins keep the access they already have; new ones default to off.
alter table users add column if not exists can_manage_courier boolean not null default false;
update users set can_manage_courier = can_manage_requests where role = 'branch_admin';
