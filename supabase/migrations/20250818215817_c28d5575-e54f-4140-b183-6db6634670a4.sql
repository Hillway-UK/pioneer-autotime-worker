-- Ensure notification_preferences table exists with proper structure
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  push_token TEXT,
  morning_reminder BOOLEAN DEFAULT TRUE,
  evening_reminder BOOLEAN DEFAULT TRUE,
  reminder_time_morning TIME DEFAULT '09:00:00',
  reminder_time_evening TIME DEFAULT '19:00:00',
  enabled_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id)
);

-- Enable RLS on notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for notification_preferences
CREATE POLICY "Workers can manage own notification preferences" 
ON notification_preferences 
FOR ALL 
USING (worker_id IN (
  SELECT id FROM workers WHERE email = auth.email()
));

CREATE POLICY "Managers can view all notification preferences" 
ON notification_preferences 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM managers WHERE email = auth.email()
));