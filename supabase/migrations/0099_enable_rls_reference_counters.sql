-- reference_counters and mailin_requests aren't created by any migration in
-- this repo — legacy leftovers (reference_counters predates the count(*)
-- -based reference-number scheme lib/actions.ts uses now; mailin_requests
-- predates what's now courier_requests) — so both were missed by
-- 0098_enable_rls.sql's table list and stayed flagged by Supabase's
-- Security Advisor. Same fix, same reasoning as 0098: this app never uses
-- the Data API, so enabling RLS here doesn't change anything the app
-- itself can do, it just closes these tables' REST endpoints to the public.

alter table if exists reference_counters enable row level security;
alter table if exists mailin_requests enable row level security;
