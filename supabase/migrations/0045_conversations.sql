-- A threaded message log per lead/customer — separate from the single
-- freeform "notes" field and from the system-generated Activity Log, this
-- is a chat-style timeline staff can log every inquiry/call/text/email
-- against, so the whole team sees the full back-and-forth in one place.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'customer')),
  entity_id uuid not null,
  channel text not null default 'note' check (channel in ('note', 'call', 'sms', 'email', 'chat')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  message text not null,
  staff_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists conversations_entity_idx on conversations (entity_type, entity_id);
