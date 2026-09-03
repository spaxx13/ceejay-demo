-- Rounds out per-transaction expense tracking (alongside parts_cost) so the
-- Sales by Technician report can break down Total Expenses into
-- Parts/Material, Labor/Service, and Other, and compute net profit.

alter table repair_records add column if not exists labor_cost numeric(12,2) not null default 0;
alter table repair_records add column if not exists other_expenses numeric(12,2) not null default 0;
alter table service_agreements add column if not exists labor_cost numeric(12,2) not null default 0;
alter table service_agreements add column if not exists other_expenses numeric(12,2) not null default 0;
