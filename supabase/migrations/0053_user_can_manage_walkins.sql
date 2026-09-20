-- Walk-In Registrations access is being split out from Home Service
-- Requests' canManageRequests flag into its own dial, so the owner can
-- grant a branch admin one without the other. Defaults to false (not
-- inherited from canManageRequests) since this is a deliberate new choice
-- per account, not a continuation of existing behavior — the owner picks
-- who gets it from Settings > Staff Accounts.
alter table users add column if not exists can_manage_walkins boolean not null default false;
