-- Lets a technician or branch admin mark "I'm here" for the day, separate
-- from login_logs (which fires on every login, not necessarily an arrival
-- at a branch). user_name/role/branch_name are denormalized the same way
-- login_logs does it, so historical rows stay readable even if the
-- account is renamed/deleted or the branch is renamed.
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text not null,
  role role not null,
  branch_id uuid references branches(id) on delete set null,
  branch_name text not null,
  checked_in_at timestamptz not null default now()
);
create index check_ins_checked_in_at_idx on check_ins (checked_in_at desc);
create index check_ins_user_idx on check_ins (user_id);

-- One check-in per user per calendar day — the app also checks this before
-- inserting, but the constraint is what actually prevents a double
-- check-in under a race (e.g. a double-tap submitting twice). Explicitly
-- Asia/Manila (not the database's own session/server timezone, which on
-- Supabase defaults to UTC) so the day boundary matches what a Philippines
-- branch actually considers "today" — see lib/format.ts's TIME_ZONE.
create unique index check_ins_user_day_idx on check_ins (user_id, ((checked_in_at at time zone 'Asia/Manila')::date)) where user_id is not null;
