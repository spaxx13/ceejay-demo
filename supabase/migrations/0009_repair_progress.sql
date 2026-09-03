-- Free-form work-in-progress notes a technician can update repeatedly while
-- a job is "In Progress" — distinct from the pre/post-repair checklist
-- (service_agreements), which is a one-shot signed sign-off per phase.

create table repair_progress (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references home_service_requests(id) on delete cascade,
  inspection_results text not null default '',
  progress_notes text not null default '',
  parts_replaced text not null default '',
  other_details text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);
