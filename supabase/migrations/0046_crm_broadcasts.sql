-- CRM > Send Announcement history + scheduling. A row is created for every
-- broadcast (immediate or scheduled) so admins can see what went out and
-- when; "pending" rows with scheduled_at in the future are what the
-- send-scheduled-broadcasts cron looks for.
create table crm_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text not null,
  photos jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz,
  status text not null default 'sent',
  recipient_estimate integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index crm_broadcasts_status_scheduled_at_idx on crm_broadcasts (status, scheduled_at);
create index crm_broadcasts_created_at_idx on crm_broadcasts (created_at desc);
