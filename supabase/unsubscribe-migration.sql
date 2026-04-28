-- Add unsubscribe tokens to tournament email recipients
alter table email_recipients
  add column if not exists unsubscribe_token uuid unique default gen_random_uuid();

-- Backfill existing rows that got null (pre-default)
update email_recipients set unsubscribe_token = gen_random_uuid() where unsubscribe_token is null;

-- Make non-nullable now that all rows have a value
alter table email_recipients alter column unsubscribe_token set not null;

-- Same for global recipients (if table exists)
alter table global_email_recipients
  add column if not exists unsubscribe_token uuid unique default gen_random_uuid();

update global_email_recipients set unsubscribe_token = gen_random_uuid() where unsubscribe_token is null;

alter table global_email_recipients alter column unsubscribe_token set not null;
