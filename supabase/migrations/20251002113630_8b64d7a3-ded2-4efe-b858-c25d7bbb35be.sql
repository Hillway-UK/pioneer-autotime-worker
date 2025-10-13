-- Phase 1: Add shift schedule support to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS shift_start TIME DEFAULT '07:00:00',
ADD COLUMN IF NOT EXISTS shift_end TIME DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS shift_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5];

COMMENT ON COLUMN jobs.shift_start IS 'Start time of the work shift';
COMMENT ON COLUMN jobs.shift_end IS 'End time of the work shift';
COMMENT ON COLUMN jobs.shift_days IS 'Days of week for shift (0=Sunday, 6=Saturday)';

-- Phase 2: Create auto clock-out counter table
CREATE TABLE IF NOT EXISTS auto_clockout_counters (
  worker_id UUID PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  count_monthly INTEGER DEFAULT 0 NOT NULL,
  rolling14_count INTEGER DEFAULT 0 NOT NULL,
  last_auto_clockout_at TIMESTAMPTZ,
  last_workday_auto DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_counters_month ON auto_clockout_counters(month);
CREATE INDEX IF NOT EXISTS idx_auto_counters_worker ON auto_clockout_counters(worker_id);

COMMENT ON TABLE auto_clockout_counters IS 'Tracks auto clock-out frequency per worker';

-- Phase 3: Create auto clock-out reason enum and audit table
DO $$ BEGIN
  CREATE TYPE auto_clockout_reason AS ENUM (
    'OK',
    'CAP_MONTH',
    'CAP_ROLLING14',
    'CONSECUTIVE_BLOCK',
    'NO_CLOCK_IN',
    'NO_SHIFT',
    'ALREADY_CLOCKED_OUT',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS auto_clockout_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  performed BOOLEAN NOT NULL,
  reason auto_clockout_reason NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  UNIQUE(worker_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_audit_worker_date ON auto_clockout_audit(worker_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_audit_performed ON auto_clockout_audit(performed);
CREATE INDEX IF NOT EXISTS idx_audit_reason ON auto_clockout_audit(reason);

COMMENT ON TABLE auto_clockout_audit IS 'Audit trail for all auto clock-out attempts';

-- Phase 4: Extend clock_entries for source tracking
ALTER TABLE clock_entries 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_clock_entries_source ON clock_entries(source);

COMMENT ON COLUMN clock_entries.source IS 'Origin of clock entry: manual or system_auto';
COMMENT ON COLUMN clock_entries.photo_required IS 'Whether photo is required for this entry';

-- Phase 5: Create notification tracking table
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  shift_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled BOOLEAN DEFAULT false,
  UNIQUE(worker_id, notification_type, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_notif_log_worker_date ON notification_log(worker_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_notif_log_type ON notification_log(notification_type);

COMMENT ON TABLE notification_log IS 'Tracks sent and canceled notifications for idempotency';

-- Phase 6: RLS Policies for new tables

-- Auto clockout counters
ALTER TABLE auto_clockout_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can view own counters" ON auto_clockout_counters;
CREATE POLICY "Workers can view own counters"
ON auto_clockout_counters FOR SELECT
USING (worker_id IN (SELECT id FROM workers WHERE email = auth.email()));

DROP POLICY IF EXISTS "Managers can view org counters" ON auto_clockout_counters;
CREATE POLICY "Managers can view org counters"
ON auto_clockout_counters FOR SELECT
USING (worker_id IN (
  SELECT w.id FROM workers w
  JOIN managers m ON w.organization_id = m.organization_id
  WHERE m.email = auth.email()
));

DROP POLICY IF EXISTS "Service role can manage counters" ON auto_clockout_counters;
CREATE POLICY "Service role can manage counters"
ON auto_clockout_counters FOR ALL
USING (true);

-- Auto clockout audit
ALTER TABLE auto_clockout_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can view own audit" ON auto_clockout_audit;
CREATE POLICY "Workers can view own audit"
ON auto_clockout_audit FOR SELECT
USING (worker_id IN (SELECT id FROM workers WHERE email = auth.email()));

DROP POLICY IF EXISTS "Managers can view org audit" ON auto_clockout_audit;
CREATE POLICY "Managers can view org audit"
ON auto_clockout_audit FOR SELECT
USING (worker_id IN (
  SELECT w.id FROM workers w
  JOIN managers m ON w.organization_id = m.organization_id
  WHERE m.email = auth.email()
));

DROP POLICY IF EXISTS "Service role can manage audit" ON auto_clockout_audit;
CREATE POLICY "Service role can manage audit"
ON auto_clockout_audit FOR ALL
USING (true);

-- Notification log
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can view own notifications" ON notification_log;
CREATE POLICY "Workers can view own notifications"
ON notification_log FOR SELECT
USING (worker_id IN (SELECT id FROM workers WHERE email = auth.email()));

DROP POLICY IF EXISTS "Managers can view org notifications" ON notification_log;
CREATE POLICY "Managers can view org notifications"
ON notification_log FOR SELECT
USING (worker_id IN (
  SELECT w.id FROM workers w
  JOIN managers m ON w.organization_id = m.organization_id
  WHERE m.email = auth.email()
));

DROP POLICY IF EXISTS "Service role can manage notifications" ON notification_log;
CREATE POLICY "Service role can manage notifications"
ON notification_log FOR ALL
USING (true);