-- Adds a per-job warranty statement to the post-repair checklist, so it can
-- be included on the emailed customer receipt alongside the rest of the
-- job details. Only meaningful for phase = 'post_repair', but kept on the
-- shared service_agreements table like the other checklist fields.

alter table service_agreements add column if not exists warranty_coverage text not null default '';
