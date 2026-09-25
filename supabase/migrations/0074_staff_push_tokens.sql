-- Device tokens for push notifications to the staff apps (Admin, and later
-- Technician/Rider) via Firebase Cloud Messaging — parallel to
-- customer_push_tokens, but keyed to the staff `users` table instead of
-- `customers` since staff sign in through a separate auth system.
create table staff_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index staff_push_tokens_user_id_idx on staff_push_tokens (user_id);
