-- Firebase Cloud Messaging device tokens, one row per native-app install a
-- staff account has notifications enabled on. Separate from
-- push_subscriptions (Web Push/VAPID, for the browser/PWA build) because the
-- native admin/technician/rider apps use Firebase Messaging instead — a
-- Capacitor app's WKWebView can't receive standard Web Push, so notifying it
-- requires FCM relaying through APNs. See lib/fcm.ts.
create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists fcm_tokens_user_idx on fcm_tokens (user_id);
