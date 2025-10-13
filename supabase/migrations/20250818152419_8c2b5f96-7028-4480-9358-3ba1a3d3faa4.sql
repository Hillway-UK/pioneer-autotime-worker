-- Enable realtime for jobs table
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- Add jobs table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;