-- Run this once against the existing Supabase project (same one the main
-- Ceejay app already uses).

create table if not exists posted_batches (
  id bigint generated always as identity primary key,
  branch text not null,
  post_date date not null,
  photo_ids text[] not null,
  fb_post_id text,
  posted_at timestamptz not null default now(),
  unique (branch, post_date)
);

comment on table posted_batches is
  'Tracks which (branch, day) photo batches have already been auto-posted to Facebook, so the auto-poster cron jobs never repost the same day.';
