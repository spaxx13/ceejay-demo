-- Device tokens for push notifications to the Ceejay customer app (FCM/APNs
-- via Firebase Cloud Messaging) — a customer can have more than one device
-- registered, so this is its own table rather than a column on customers.
create table customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index customer_push_tokens_customer_id_idx on customer_push_tokens (customer_id);
