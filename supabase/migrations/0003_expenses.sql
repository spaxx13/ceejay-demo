-- Daily expense recording — one row per expense, tied to the calendar day
-- it was incurred (not just a timestamp) so admins can see and total
-- expenses per day per branch. Categories reuse the generic lookups table
-- (kind = 'expense_category'), same Add/Edit/Deactivate pattern as every
-- other type/category list in the system.

alter type lookup_kind add value 'expense_category';

create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  branch_id uuid references branches(id) on delete set null,
  category_id uuid references lookups(id) on delete set null,
  amount numeric(12,2) not null default 0,
  description text not null default '',
  recorded_by text not null default '',
  created_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (expense_date);
create index expenses_branch_idx on expenses (branch_id);

alter table expenses enable row level security;
