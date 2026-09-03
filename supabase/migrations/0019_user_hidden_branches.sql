-- Lets a branch admin's account be scoped away from specific branches —
-- e.g. a branch admin who shouldn't see another branch's tickets or sales.
-- Empty (default) means no restriction, same as today for every existing
-- account.

alter table users add column if not exists hidden_branch_ids uuid[] not null default '{}';
