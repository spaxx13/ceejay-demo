-- Web push subscriptions, one row per browser/device a staff account has
-- enabled notifications on (a user can have several — phone + desktop).
-- endpoint is the browser-assigned push URL and is unique per
-- subscription; re-subscribing the same browser (e.g. after clearing site
-- data) just replaces its row via upsert.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Lets the owner opt an admin/branch admin into SMS alerts (same events as
-- web push) by setting a phone number on their account, Admin > Users.
-- Empty means not opted in.
alter table users add column if not exists phone text not null default '';
