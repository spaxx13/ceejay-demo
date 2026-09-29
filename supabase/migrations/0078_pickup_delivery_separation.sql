-- Lets an owner mark which technicians are allowed to take a Pickup &
-- Delivery repair (once the rider brings the device to a branch) — separate
-- from the technician's home-service branch/zone assignment, since not
-- every technician who does on-site home service visits is meant to also
-- handle Pickup & Delivery jobs. Enforced in the assignment dropdown on
-- Admin > Pickup & Delivery (app/admin/pickup-delivery/[id]/page.tsx).
alter table technicians add column if not exists can_pickup_delivery boolean not null default false;
