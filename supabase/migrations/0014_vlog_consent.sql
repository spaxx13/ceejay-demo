-- Lets a customer consent to being vlogged/recorded during their home
-- service visit, and — only when they say yes — pick whether their face
-- should be blurred in any resulting footage.

alter table home_service_requests add column if not exists vlog_consent boolean not null default false;
alter table home_service_requests add column if not exists vlog_blur_preference text not null default '';
