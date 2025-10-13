-- Fix the main security issue: restrict managers table access instead of public access
DROP POLICY IF EXISTS "Public can check manager status for authentication" ON managers;

-- Create a security definer function to check manager status safely
CREATE OR REPLACE FUNCTION public.check_is_manager(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE email = user_email
  );
$$;

-- Restore proper managers policy using the function
CREATE POLICY "Managers can view manager data" ON managers
  FOR SELECT 
  USING (public.check_is_manager(auth.email()));