-- A rider-controlled "on duty" toggle, separate from the admin-controlled
-- `active` column (which is "does this rider account exist/is it
-- enabled", not "are they working right now"). Riders flip this
-- themselves from /rider; admins see it live on Admin > Riders and the
-- Pickup & Delivery board, and it's what the public booking form actually
-- checks before promising "a rider is available for your pickup".
alter table riders add column on_duty boolean not null default false;
