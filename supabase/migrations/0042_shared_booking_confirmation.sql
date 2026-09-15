-- A multi-device booking now shares one confirmation_token across every
-- device's row (one quotation email, one "Confirm My Booking" link
-- confirms all of them together) instead of a distinct token per device —
-- drop the per-row uniqueness so the same token can appear on several
-- rows. The plain index (hsr_confirmation_token_idx, added in 0041) still
-- makes confirm-booking lookups fast.
alter table home_service_requests drop constraint if exists home_service_requests_confirmation_token_key;
