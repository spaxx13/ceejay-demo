-- Admin notification (in-app list + PWA push + SMS) when a technician marks
-- their Home Service job "On the Way" — see technicianUpdateStatus.
alter type notification_type add value if not exists 'technician_on_the_way';
