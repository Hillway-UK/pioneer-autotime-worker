-- Schedule 12-hour fallback auto-clockout to run every hour
-- This catches any workers who have been clocked in for more than 12 hours
-- Complements the primary auto-clockout at 17:00-17:10
SELECT cron.schedule(
  'auto-clockout-12-hour-fallback',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT auto_clock_out_after_12_hours();
  $$
);