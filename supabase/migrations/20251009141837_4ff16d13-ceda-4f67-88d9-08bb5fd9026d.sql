-- Allow workers to view their own organization
CREATE POLICY "Workers can view own organization"
ON organizations
FOR SELECT
TO public
USING (
  id IN (
    SELECT organization_id
    FROM workers
    WHERE email = auth.email()
  )
);