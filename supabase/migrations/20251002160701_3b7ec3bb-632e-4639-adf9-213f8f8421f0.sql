-- Fix security issue: Restrict "Service role can manage audit" policy to actual service role
-- The previous policy used USING (true) which made the table publicly readable
-- Now it properly checks that the JWT role is 'service_role'

DROP POLICY IF EXISTS "Service role can manage audit" ON public.auto_clockout_audit;

CREATE POLICY "Service role can manage audit"
ON public.auto_clockout_audit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
