-- Lets staff waive the flat per-visit Home Service fee for a specific
-- request (e.g. goodwill gesture, repeat customer). The fee itself stays
-- computed from province the same way it always has
-- (lib/homeServiceFees.ts's serviceFeeAmount) — this just marks that this
-- particular request's fee should be treated as waived wherever it's
-- displayed/quoted, without touching the underlying province fee table.
alter table home_service_requests add column if not exists service_fee_waived boolean not null default false;
