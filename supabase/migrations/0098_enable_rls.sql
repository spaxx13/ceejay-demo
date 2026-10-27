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

alter table activity_log enable row level security;
alter table branches enable row level security;
alter table check_ins enable row level security;
alter table conversations enable row level security;
alter table courier_requests enable row level security;
alter table crm_broadcasts enable row level security;
alter table custom_form_fields enable row level security;
alter table customer_push_tokens enable row level security;
alter table customers enable row level security;
alter table device_models enable row level security;
alter table email_otp_codes enable row level security;
alter table expenses enable row level security;
alter table home_service_requests enable row level security;
alter table icloud_checks enable row level security;
alter table inventory_items enable row level security;
alter table leads enable row level security;
alter table login_logs enable row level security;
alter table lookups enable row level security;
alter table manual_checklists enable row level security;
alter table manual_repair_records enable row level security;
alter table notifications enable row level security;
alter table otp_codes enable row level security;
alter table posted_batches enable row level security;
alter table push_subscriptions enable row level security;
alter table repair_progress enable row level security;
alter table repair_records enable row level security;
alter table request_exceptions enable row level security;
alter table request_form_content enable row level security;
alter table request_updates enable row level security;
alter table riders enable row level security;
alter table sale_line_items enable row level security;
alter table sales enable row level security;
alter table service_agreements enable row level security;
alter table service_fee_waivers enable row level security;
alter table service_prices enable row level security;
alter table site_content enable row level security;
alter table staff_chat_messages enable row level security;
alter table staff_push_tokens enable row level security;
alter table stock_movements enable row level security;
alter table technicians enable row level security;
alter table users enable row level security;
alter table walkin_requests enable row level security;
alter table zones enable row level security;
