-- Let the existing pre/post-repair checklist (service_agreements) attach to
-- either a home service request (technician flow) OR a POS repair record
-- (admin/branch admin flow) — exactly one of the two must be set.

alter table service_agreements alter column request_id drop not null;
alter table service_agreements add column repair_record_id uuid references repair_records(id) on delete cascade;

alter table service_agreements add constraint service_agreements_target_check check (
  (request_id is not null and repair_record_id is null) or (request_id is null and repair_record_id is not null)
);
alter table service_agreements add constraint service_agreements_repair_record_phase_unique unique (repair_record_id, phase);
