-- New per-account permission (branch_admin scoped, owner_admin always
-- allowed) controlling who can waive a Home Service request's visit fee —
-- independent of canManageRequests, same pattern as can_manage_walkins
-- (0053). Defaults to false: a deliberate per-account grant, not
-- inherited from existing access.
alter table users add column if not exists can_waive_service_fee boolean not null default false;
