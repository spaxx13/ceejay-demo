-- Lets an owner admin control, per branch-admin account, whether that
-- account can see combined "All Branches" sales figures on Branch Sales
-- (the aggregate stat cards, the All-Branches summary card, and Owner
-- Deductions). Defaults to false: a branch admin only sees the individual
-- branch card(s) for whatever branch(es) they're assigned, never a
-- cross-branch rollup, unless explicitly granted this permission.

alter table users add column if not exists can_view_all_branches boolean not null default false;
