-- Manual Checklist & Receipt access for technician accounts — owner_admin
-- and branch_admin always have it (same as POS), so this flag only ever
-- gates technician-role accounts. Defaults to false: the owner picks which
-- specific technicians get it, from Settings > Staff Accounts.
alter table users add column if not exists can_manage_manual_checklists boolean not null default false;
