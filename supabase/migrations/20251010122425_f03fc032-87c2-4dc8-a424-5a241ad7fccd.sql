-- Create geofence_events table to track location fixes and exit events
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  clock_entry_id UUID NOT NULL REFERENCES public.clock_entries(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('location_fix', 'exit_detected', 'exit_confirmed', 're_entry')),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC NOT NULL,
  distance_from_center NUMERIC NOT NULL,
  job_radius INTEGER NOT NULL,
  safe_out_threshold INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX idx_geofence_events_worker_date ON public.geofence_events(worker_id, shift_date);
CREATE INDEX idx_geofence_events_clock_entry ON public.geofence_events(clock_entry_id);
CREATE INDEX idx_geofence_events_timestamp ON public.geofence_events(timestamp);

-- Add auto_clockout_type column to clock_entries
ALTER TABLE public.clock_entries 
ADD COLUMN IF NOT EXISTS auto_clockout_type TEXT CHECK (auto_clockout_type IN ('geofence', 'time_based'));

-- Add geofence_exit_data column to store exit location details
ALTER TABLE public.clock_entries 
ADD COLUMN IF NOT EXISTS geofence_exit_data JSONB;

-- Create index on auto_clockout_type for filtering
CREATE INDEX idx_clock_entries_auto_type ON public.clock_entries(auto_clockout_type);

-- RLS policies for geofence_events
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

-- Workers can view their own geofence events
CREATE POLICY "Workers can view own geofence events"
ON public.geofence_events
FOR SELECT
USING (
  worker_id IN (
    SELECT id FROM public.workers WHERE email = auth.email()
  )
);

-- Managers can view organization geofence events
CREATE POLICY "Managers can view organization geofence events"
ON public.geofence_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    JOIN public.managers m ON w.organization_id = m.organization_id
    WHERE w.id = geofence_events.worker_id
    AND m.email = auth.email()
  )
);

-- Super admins can view all geofence events
CREATE POLICY "Super admins can view all geofence events"
ON public.geofence_events
FOR SELECT
USING (is_super_admin(auth.email()));

-- Service role can insert geofence events (from edge function)
CREATE POLICY "Service role can insert geofence events"
ON public.geofence_events
FOR INSERT
WITH CHECK (true);