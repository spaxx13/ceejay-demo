-- Per-branch Pickup & Delivery workload share (percent). When at least one
-- branch has a share > 0, new P&D bookings are recommended to branches in
-- those proportions (e.g. Cubao 80 / Greenhills 20), balanced against the
-- last 30 days of bookings, instead of purely "nearest branch". The fee is
-- still computed from the nearest branch. All zero = nearest branch, as
-- before. Set in Admin > Settings > Branches.
alter table branches add column if not exists pickup_delivery_share integer not null default 0;
