-- Home Service Request OTP verification is switching from email to SMS
-- (Semaphore) now that a sender name is approved. otp_codes was already
-- keyed by email; this repoints it at phone the same way migration 0028
-- did before it was reverted in 0029.
alter table otp_codes rename column email to phone;
