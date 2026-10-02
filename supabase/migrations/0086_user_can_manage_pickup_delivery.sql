-- Pickup & Delivery access gets its own dial, split out from Home Service
-- Requests' can_manage_requests — the owner picks exactly which branch
-- admins see the Pickup & Delivery section (Admin > Pickup & Delivery, its
-- job pages, rider assignment, unboxing/updates moderation, the staff
-- preview of the booking form, and Sales > Pickup & Delivery). Owner admins
-- always have it. Defaults to false for every existing and new branch
-- admin; set from Settings > Staff Accounts.
alter table users add column if not exists can_manage_pickup_delivery boolean not null default false;
