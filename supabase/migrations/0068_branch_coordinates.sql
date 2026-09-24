-- Plain address-text geocoding (via Google's Maps Embed API) is often
-- imprecise for informal/local place names — e.g. "Farmers Plaza, Cubao"
-- resolving to the more prominent, adjacent Gateway Mall instead. Letting
-- an admin pin exact coordinates per branch (copied straight from Google
-- Maps) fixes that at the source: the live tracking map on /track prefers
-- these over the address text whenever they're set.

alter table branches
  add column lat double precision,
  add column lng double precision;
