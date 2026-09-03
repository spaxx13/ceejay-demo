-- Lets an owner admin control, per staff account, whether a branch admin can
-- access and manage Home Service Requests. Defaults to true so every
-- existing account keeps its current access.

alter table users add column if not exists can_manage_requests boolean not null default true;
