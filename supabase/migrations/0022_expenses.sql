-- Owner-managed business expenses (rent, utilities, tools, etc. — separate
-- from the per-ticket parts/labor/other cost fields already on repair
-- records and service agreements). Each expense is deducted from exactly
-- one of three totals shown on the Sales reports:
--   owner_final_total_sales      -> Owner's Final Total Sales (all-branch, 50% figure)
--   owner_total_sales            -> Total Sales of the Owner (all-branch, raw combined revenue)
--   technician_final_total_sales -> a specific technician's Final Total Sales (technician_name required)

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric not null,
  target text not null check (target in ('owner_final_total_sales', 'owner_total_sales', 'technician_final_total_sales')),
  technician_name text,
  expense_date date not null default current_date,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
