# RAMS & Site Information Setup Instructions

## Database Setup

Since migrations folder is read-only, you need to run this SQL manually in your Supabase SQL Editor:

```sql
-- Create RAMS acceptances table
CREATE TABLE IF NOT EXISTS rams_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  terms_and_conditions_url text,
  waiver_url text,
  accepted_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rams_acceptances_worker_job 
  ON rams_acceptances(worker_id, job_id, accepted_at DESC);

-- Enable RLS
ALTER TABLE rams_acceptances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workers can view their own RAMS acceptances"
  ON rams_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

CREATE POLICY "Workers can insert their own RAMS acceptances"
  ON rams_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

-- Add RAMS/Site Info columns to jobs table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'terms_and_conditions_url') THEN
    ALTER TABLE jobs ADD COLUMN terms_and_conditions_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'waiver_url') THEN
    ALTER TABLE jobs ADD COLUMN waiver_url text;
  END IF;
END $$;
```

## Adding Documents to Jobs

After running the SQL above, you can add RAMS and Site Information documents to your jobs:

1. Go to your Supabase Dashboard > Storage
2. Upload your RAMS PDF and Site Information PDF files
3. Copy the public URLs
4. Update the jobs table with these URLs:

```sql
UPDATE jobs 
SET 
  terms_and_conditions_url = 'https://your-project.supabase.co/storage/v1/object/public/bucket/rams.pdf',
  waiver_url = 'https://your-project.supabase.co/storage/v1/object/public/bucket/site-info.pdf'
WHERE id = 'your-job-id';
```

## How It Works

1. **Clock In Flow**: When a worker clicks "Clock In", they are first shown the RAMS Acceptance Dialog
2. **Required Viewing**: Both accordions (RAMS and Site Information) must be opened before the checkbox can be enabled
3. **Confirmation**: Worker must check the confirmation box to proceed
4. **Acceptance Recording**: The system records the acceptance in the `rams_acceptances` table
5. **Proceed**: Only after acceptance does the normal clock-in flow continue (location, photo, etc.)

## Edge Functions

Two edge functions have been created:
- `validate-rams-acceptance`: Fetches RAMS and Site Info URLs for a job
- `record-rams-acceptance`: Records the worker's acceptance

These are configured in `supabase/config.toml` with JWT authentication enabled.

## Missing Documents

If a job doesn't have RAMS or Site Information documents uploaded:
- The accordions will show a message: "Document is not available"
- Workers can still proceed (they must still open both sections)
- The system records `null` for missing document URLs

## Acceptance Audit Trail

Every clock-in creates a new record in `rams_acceptances` with:
- Worker ID
- Job ID
- Document URLs at time of acceptance
- Timestamp

This provides a complete audit trail of safety document acceptance.
