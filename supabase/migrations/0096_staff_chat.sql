-- A single shared group chat every staff account (owner admin, branch
-- admin, technician, rider) can post to and read from /staff-chat — no
-- channels/DMs, just one room, polled from the client like the existing
-- live technician tracking (no websocket/Realtime infra in this app).
create table staff_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text not null,
  role role not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index staff_chat_messages_created_at_idx on staff_chat_messages (created_at);
