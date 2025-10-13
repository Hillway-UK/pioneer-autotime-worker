-- Add must_change_password column to workers table
ALTER TABLE public.workers 
ADD COLUMN must_change_password boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_workers_must_change_password ON public.workers(must_change_password) WHERE must_change_password = true;

COMMENT ON COLUMN public.workers.must_change_password IS 'Flag indicating if worker must change password on next login (e.g., after temp password is set)';