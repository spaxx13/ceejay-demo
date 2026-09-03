create table login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text not null,
  user_email text not null,
  role role not null,
  at timestamptz not null default now()
);
create index login_logs_at_idx on login_logs (at desc);
create index login_logs_user_idx on login_logs (user_id);
