-- Add dedupe_key column for notification idempotency
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Create unique index on dedupe_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON notifications(dedupe_key);

-- Add index for worker_id + created_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_worker_created ON notifications(worker_id, created_at DESC);

-- Enable realtime for notifications table
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;