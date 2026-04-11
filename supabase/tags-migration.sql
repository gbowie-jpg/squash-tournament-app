-- Add tags array to email_recipients for recipient filtering
ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
