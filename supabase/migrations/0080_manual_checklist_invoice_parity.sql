-- Lets a manual (walk-in) repair ticket's receipt carry the same "Nature of
-- Repair" and "Technician" lines the normal Home Service/POS receipt does,
-- so the two invoice types can share one PDF template exactly.
alter table manual_repair_records add column if not exists issue_description text not null default '';
-- Who actually completed this specific phase (pre or post) — the parent
-- ticket's created_by_name is who opened the ticket, which isn't
-- necessarily who performed a given phase.
alter table manual_checklists add column if not exists technician_name text not null default '';
