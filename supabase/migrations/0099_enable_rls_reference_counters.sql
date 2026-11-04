-- reference_counters isn't created by any migration in this repo (a legacy
-- table from before reference numbers switched to the count(*)-based scheme
-- lib/actions.ts uses now) and so was missed by 0098_enable_rls.sql's
-- table list — Supabase's Security Advisor re-flagged it as publicly
-- accessible. Same fix, same reasoning as 0098: this app never uses the
-- Data API, so enabling RLS here doesn't change anything the app itself
-- can do, it just closes that table's REST endpoint to the public.

alter table if exists reference_counters enable row level security;
