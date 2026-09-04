-- Lets each technician have their own earnings share (as a percent of Net)
-- instead of the shop-wide default of 70%. Owner-technicians (e.g. the shop
-- owner working as a technician) may keep 100% of their own jobs' net;
-- everyone else defaults to the standard 70% split.

alter table technicians add column if not exists earnings_share_percent numeric not null default 70;
