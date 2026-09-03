-- Flips branch scoping for staff (branch_admin) accounts from an exclusion
-- list to an allow-list: assigned_branch_ids lists the branches an account
-- CAN access. Empty (default) means no restriction, same as today for every
-- existing account. This replaces the short-lived hidden_branch_ids column
-- (exclusion-list) introduced for a one-off branch hide — same array shape,
-- inverted meaning.

alter table users rename column hidden_branch_ids to assigned_branch_ids;
