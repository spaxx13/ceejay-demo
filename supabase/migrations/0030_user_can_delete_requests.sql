-- Lets an owner admin grant a branch admin the ability to permanently delete
-- Home Service Requests — separate from can_manage_requests, since deleting
-- is irreversible and should stay off by default even for accounts that can
-- otherwise manage requests.

alter table users add column if not exists can_delete_requests boolean not null default false;
