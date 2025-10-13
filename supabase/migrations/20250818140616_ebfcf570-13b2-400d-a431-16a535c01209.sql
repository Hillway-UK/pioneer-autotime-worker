-- Fix security issue: Restrict job access to authenticated workers only
-- Drop the overly permissive policy that allows anyone to view jobs
DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.jobs;

-- Create a new policy that requires authentication and worker status
CREATE POLICY "Authenticated workers can view active jobs" 
ON public.jobs 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.workers 
    WHERE workers.email = auth.email()
    AND workers.is_active = true
  )
);