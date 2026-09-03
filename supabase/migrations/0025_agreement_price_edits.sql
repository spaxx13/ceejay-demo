-- Lets a technician self-correct the Repair Price / Labor-Service Cost on
-- their own completed Post-Repair checklist (e.g. a typo at submission
-- time), capped at 3 edits so it stays a correction tool, not an open
-- price field.

alter table service_agreements add column if not exists price_edit_count integer not null default 0;
