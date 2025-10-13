-- Fix notification_log public access vulnerability
-- The existing "Service role full access for notifications" policy was using USING (true)
-- which made the table publicly readable. We need to restrict it to actual service_role only.

DROP POLICY IF EXISTS "Service role full access for notifications" ON public.notification_log;

CREATE POLICY "Service role full access for notifications"
ON public.notification_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);