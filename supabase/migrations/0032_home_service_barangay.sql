-- Captures the barangay selected via the cascading Province -> City ->
-- Barangay dropdown used on the "near" (Metro Manila/Laguna/Batangas/
-- Quezon/Rizal/Bulacan/Cavite/Pampanga) Home Service booking form. The
-- customer's exact address still goes in the existing free-text street
-- field — this only carries the barangay-level selection.

alter table home_service_requests add column if not exists barangay text not null default '';
