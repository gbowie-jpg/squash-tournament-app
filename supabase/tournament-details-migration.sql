-- Add detailed fields to tournaments table
alter table tournaments
  add column if not exists image_url text,
  add column if not exists category text,
  add column if not exists location_city text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists registration_opens date,
  add column if not exists registration_deadline date,
  add column if not exists draw_lock_date date,
  add column if not exists entry_close_date date,
  add column if not exists info_latest text,
  add column if not exists info_accommodations text,
  add column if not exists info_entry text,
  add column if not exists info_rules text;
