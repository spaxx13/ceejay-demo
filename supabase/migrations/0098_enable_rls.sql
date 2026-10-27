-- Closes the Supabase Advisor's "rls_disabled_in_public" /
-- "sensitive_columns_exposed" findings. This app never uses Supabase's
-- Data API (PostgREST) or supabase-js — lib/db.ts talks to Postgres
-- directly via POSTGRES_URL (the `postgres` role, which bypasses RLS as
-- Postgres superuser), so enabling RLS here with no policies doesn't
-- change anything the app can see or do. It only shuts the door Supabase
-- leaves open by default: every public table, including `users`
-- (password_hash) and every customer/request table, is otherwise
-- reachable over the internet via the project's REST endpoint by anyone
-- holding its anon/public API key. With RLS on and no policies, that
-- endpoint denies every request instead.
--
-- IF EXISTS on every line: the flagged Supabase projects don't all carry
-- the exact same table set (e.g. one is missing icloud_checks), so this
-- stays safe to run as-is against any of them instead of aborting the
-- whole batch on the first table that isn't there.

alter table if exists activity_log enable row level security;
alter table if exists branches enable row level security;
alter table if exists check_ins enable row level security;
alter table if exists conversations enable row level security;
alter table if exists courier_requests enable row level security;
alter table if exists crm_broadcasts enable row level security;
alter table if exists custom_form_fields enable row level security;
alter table if exists customer_push_tokens enable row level security;
alter table if exists customers enable row level security;
alter table if exists device_models enable row level security;
alter table if exists email_otp_codes enable row level security;
alter table if exists expenses enable row level security;
alter table if exists home_service_requests enable row level security;
alter table if exists icloud_checks enable row level security;
alter table if exists inventory_items enable row level security;
alter table if exists leads enable row level security;
alter table if exists login_logs enable row level security;
alter table if exists lookups enable row level security;
alter table if exists manual_checklists enable row level security;
alter table if exists manual_repair_records enable row level security;
alter table if exists notifications enable row level security;
alter table if exists otp_codes enable row level security;
alter table if exists posted_batches enable row level security;
alter table if exists push_subscriptions enable row level security;
alter table if exists repair_progress enable row level security;
alter table if exists repair_records enable row level security;
alter table if exists request_exceptions enable row level security;
alter table if exists request_form_content enable row level security;
alter table if exists request_updates enable row level security;
alter table if exists riders enable row level security;
alter table if exists sale_line_items enable row level security;
alter table if exists sales enable row level security;
alter table if exists service_agreements enable row level security;
alter table if exists service_fee_waivers enable row level security;
alter table if exists service_prices enable row level security;
alter table if exists site_content enable row level security;
alter table if exists staff_chat_messages enable row level security;
alter table if exists staff_push_tokens enable row level security;
alter table if exists stock_movements enable row level security;
alter table if exists technicians enable row level security;
alter table if exists users enable row level security;
alter table if exists walkin_requests enable row level security;
alter table if exists zones enable row level security;
