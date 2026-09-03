-- Lets a technician record the repair price when completing the
-- Post-Repair checklist on a home service request (repair_records already
-- have their own cost captured at intake, so this stays 0/unused there).

alter table service_agreements add column if not exists cost numeric(12,2) not null default 0;
