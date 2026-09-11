-- Human-readable references (REPAIR-, HSR-, PRC-, SA-) were previously
-- generated as `select count(*) + 1` against the target table. That is not
-- atomic: concurrent submissions can read the same count before either
-- commits, and deleting a record (see deleteRepairRecord) shrinks the count
-- so a later insert can recompute a number that's still in use. Both cases
-- trip the `reference` unique constraint on repair_records,
-- home_service_requests, and service_agreements.
--
-- This table backs an atomic per-prefix, per-year counter instead: the
-- application does `insert ... on conflict (prefix, year) do update set
-- n = n + 1 returning n`, which Postgres serializes via the row's own lock,
-- so no two callers can ever get the same number, and numbers are never
-- reused once handed out.
create table reference_counters (
  prefix text not null,
  year int not null,
  n int not null default 0,
  primary key (prefix, year)
);
