-- Adds the same price/cost fields as repair_records/service_agreements —
-- cost (repair price) + labor_cost (service fee) make up the customer-
-- facing Total Amount; parts_cost + other_expenses are internal-only,
-- tracked for net profit, never shown on the receipt (PDF or email).
alter table manual_checklists add column if not exists cost numeric(12,2) not null default 0;
alter table manual_checklists add column if not exists parts_cost numeric(12,2) not null default 0;
alter table manual_checklists add column if not exists labor_cost numeric(12,2) not null default 0;
alter table manual_checklists add column if not exists other_expenses numeric(12,2) not null default 0;
