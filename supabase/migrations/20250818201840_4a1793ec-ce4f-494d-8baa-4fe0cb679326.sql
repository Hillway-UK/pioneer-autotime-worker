-- Fix RLS policies for proper authentication flow

-- First, drop existing problematic policies to ensure clean state
DROP POLICY IF EXISTS "Workers can view own record" ON workers;
DROP POLICY IF EXISTS "Authenticated workers can view active jobs" ON jobs;
DROP POLICY IF EXISTS "Workers can view active expense types" ON expense_types;

-- Workers table: Add public read access for login verification and maintain existing policies
CREATE POLICY "Public can verify active worker emails for login" ON workers
  FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Workers can view own record" ON workers
  FOR SELECT 
  USING (email = auth.email());

-- Jobs table: Simplify authentication check
CREATE POLICY "Authenticated users can view active jobs" ON jobs
  FOR SELECT 
  USING (is_active = true AND auth.role() = 'authenticated');

-- Expense types: Allow all authenticated users to read active expense types
CREATE POLICY "Authenticated users can view active expense types" ON expense_types
  FOR SELECT 
  USING (is_active = true AND auth.role() = 'authenticated');

-- Ensure managers table has proper access for the manager check function
DROP POLICY IF EXISTS "Managers can view all managers" ON managers;
CREATE POLICY "Public can check manager status for authentication" ON managers
  FOR SELECT 
  USING (true);