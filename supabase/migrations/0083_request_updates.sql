-- Progress updates the technician/admin posts to the customer while a
-- Pickup & Delivery repair is in progress: a description plus any number
-- of photos/videos. Media lives in Supabase Storage (bucket below); each
-- row only keeps the object paths in `media` (jsonb array of
-- {kind, path, contentType}). Shown on /track as a timeline.
create table if not exists request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references home_service_requests(id) on delete cascade,
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  posted_by text not null default '',
  posted_by_user_id text,
  posted_by_role text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists request_updates_request_id_idx on request_updates (request_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('request-updates', 'request-updates', false, 52428800)
on conflict (id) do nothing;
