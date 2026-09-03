-- Lets staff declare the cost of parts used on a repair (separate from the
-- price charged to the customer), so Branch Sales can deduct it to show
-- net profit alongside gross revenue.

alter table repair_records add column if not exists parts_cost numeric(12,2) not null default 0;
alter table service_agreements add column if not exists parts_cost numeric(12,2) not null default 0;
