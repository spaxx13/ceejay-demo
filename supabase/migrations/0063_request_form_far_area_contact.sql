alter table request_form_content add column if not exists far_area_contact_number text not null default '';
update request_form_content set far_area_contact_number = '09566692007' where id = 1 and far_area_contact_number = '';
