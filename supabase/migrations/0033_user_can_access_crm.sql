-- Defaults to true so existing branch admins (who could always see the CRM,
-- since it had no gate before this) keep working exactly as before until
-- the owner explicitly turns it off for a specific account.
alter table users add column if not exists can_access_crm boolean not null default true;
