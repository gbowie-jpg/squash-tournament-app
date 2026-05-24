-- Add phone number to profiles for SMS notifications
alter table profiles add column if not exists phone text;

-- Optional index for lookups
create index if not exists profiles_phone_idx on profiles (phone) where phone is not null;
