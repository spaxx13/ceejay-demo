-- New per-account permission (branch_admin scoped, owner_admin always
-- allowed) controlling who can access Repair Pricing (Settings > Catalog &
-- Workflow) — independent of every other flag, same pattern as
-- can_waive_service_fee (0055). Defaults to false: a deliberate per-account
-- grant, not inherited from existing access.
alter table users add column if not exists can_manage_repair_pricing boolean not null default false;
