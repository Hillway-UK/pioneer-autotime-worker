import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Compute current date/time in UK timezone (Europe/London with DST)
function nowInTz(tz: string = 'Europe/London') {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to handle DST automatically
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  // Format: DD/MM/YYYY for en-GB
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
  const timeHHmm = `${get('hour')}:${get('minute')}`; // HH:MM
  
  // Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const weekdayName = get('weekday'); // Mon, Tue, etc.
  const dayOfWeekMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const dayOfWeek = dayOfWeekMap[weekdayName] || 0;
  
  return { dateStr, timeHHmm, dayOfWeek, tzOffset: tz };
}

interface Worker {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  shift_start: string;
  shift_end: string;
  shift_days: number[];
}

interface GuardResult {
  canAutoClockOut: boolean;
  reason: 'OK' | 'CAP_MONTH' | 'CAP_ROLLING14' | 'CONSECUTIVE_BLOCK' | 'NO_CLOCK_IN' | 'NO_SHIFT' | 'ALREADY_CLOCKED_OUT' | 'UNKNOWN';
}

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  job_id: string;
}

serve(async (req) => {
  // Build CORS headers dynamically
  const origin = req.headers.get('origin') || '*';
  const requestHeaders = req.headers.get('access-control-request-headers') || 
                        'authorization, x-client-info, apikey, content-type';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders,
    'Access-Control-Max-Age': '86400'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const siteTime = nowInTz('Europe/London');
    const { dateStr, timeHHmm, dayOfWeek } = siteTime;
    const siteDate = new Date(dateStr + 'T00:00:00Z'); // Date-only in UTC for shift_date
    
    console.log(`Running check-clock-status at ${new Date().toISOString()}, UK time: ${dateStr} ${timeHHmm}, day: ${dayOfWeek}`);

    // Only run on weekdays (Monday=1, Friday=5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('Weekend - skipping all checks');
      return new Response(JSON.stringify({ message: 'Weekend - no actions taken' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let actionsPerformed = 0;

    // 1. Check for clock-in reminders (5min before, exact, 15min after shift_start)
    const clockInWorkers = await getWorkersForClockInReminder(supabase, timeHHmm, dayOfWeek);
    if (clockInWorkers.length > 0) {
      console.log(`Found ${clockInWorkers.length} workers for clock-in reminder at ${timeHHmm}`);
      actionsPerformed += await handleClockInReminders(supabase, timeHHmm, siteDate, clockInWorkers);
    }
    
    // 2. Check for clock-out reminders (exact, 15min after shift_end)
    const clockOutWorkers = await getWorkersForClockOutReminder(supabase, timeHHmm, dayOfWeek);
    if (clockOutWorkers.length > 0) {
      console.log(`Found ${clockOutWorkers.length} workers for clock-out reminder at ${timeHHmm}`);
      actionsPerformed += await handleClockOutReminders(supabase, timeHHmm, siteDate, clockOutWorkers);
    }
    
    // 3. Check for auto-clockout (30min to 40min after shift_end)
    const autoClockoutWorkers = await getWorkersForAutoClockout(supabase, timeHHmm, dayOfWeek);
    if (autoClockoutWorkers.length > 0) {
      console.log(`Found ${autoClockoutWorkers.length} workers in auto-clockout window at ${timeHHmm}`);
      actionsPerformed += await handleAutoClockOut(supabase, timeHHmm, siteDate, autoClockoutWorkers);
    }

    // Log even if no actions (helps debugging)
    console.log(`Check completed at ${timeHHmm}. Actions performed: ${actionsPerformed}`);
    
    return new Response(JSON.stringify({ 
      message: 'Check completed',
      actionsPerformed,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in check-clock-status:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================================
// Dynamic Worker Query Functions
// ============================================================================

async function getWorkersForClockInReminder(supabase: any, currentTime: string, dayOfWeek: number): Promise<Worker[]> {
  // Parse current time (e.g., "06:55" -> minutes since midnight)
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  
  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, email, organization_id, shift_start, shift_end, shift_days')
    .eq('is_active', true);
  
  if (error || !workers) {
    console.error('Error fetching workers:', error);
    return [];
  }
  
  // Filter workers whose shift_start matches one of:
  // - currentTime + 5min = shift_start (reminder 5min before)
  // - currentTime = shift_start (exact time)
  // - currentTime - 15min = shift_start (reminder 15min after)
  
  return workers.filter((w: Worker) => {
    if (!w.shift_days?.includes(dayOfWeek)) return false;
    if (!w.shift_start) return false;
    
    const [shiftHour, shiftMin] = w.shift_start.split(':').map(Number);
    const shiftMinutes = shiftHour * 60 + shiftMin;
    
    // Check if current time matches any reminder time
    const diff = currentMinutes - shiftMinutes;
    return diff === -5 || diff === 0 || diff === 15;
  });
}

async function getWorkersForClockOutReminder(supabase: any, currentTime: string, dayOfWeek: number): Promise<Worker[]> {
  // Parse current time
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  
  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, email, organization_id, shift_start, shift_end, shift_days')
    .eq('is_active', true);
  
  if (error || !workers) {
    console.error('Error fetching workers:', error);
    return [];
  }
  
  // Filter workers whose shift_end matches:
  // - exact, +15min (removed +30min - now handled by auto-clockout)
  
  return workers.filter((w: Worker) => {
    if (!w.shift_days?.includes(dayOfWeek)) return false;
    if (!w.shift_end) return false;
    
    const [shiftHour, shiftMin] = w.shift_end.split(':').map(Number);
    const shiftMinutes = shiftHour * 60 + shiftMin;
    
    const diff = currentMinutes - shiftMinutes;
    return diff === 0 || diff === 15; // Only exact and +15min
  });
}

async function getWorkersForAutoClockout(supabase: any, currentTime: string, dayOfWeek: number): Promise<Worker[]> {
  // Parse current time
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  
  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, email, organization_id, shift_start, shift_end, shift_days')
    .eq('is_active', true);
  
  if (error || !workers) {
    console.error('Error fetching workers:', error);
    return [];
  }
  
  // Filter workers whose shift_end + 30min to +40min = current time
  
  return workers.filter((w: Worker) => {
    if (!w.shift_days?.includes(dayOfWeek)) return false;
    if (!w.shift_end) return false;
    
    const [shiftHour, shiftMin] = w.shift_end.split(':').map(Number);
    const shiftEndMinutes = shiftHour * 60 + shiftMin;
    
    // Auto-clockout window: shift_end + 30min to +40min (11 execution attempts)
    const autoClockoutStart = shiftEndMinutes + 30;
    const autoClockoutEnd = shiftEndMinutes + 40;
    
    return currentMinutes >= autoClockoutStart && currentMinutes <= autoClockoutEnd;
  });
}

// ============================================================================
// Handler Functions
// ============================================================================

async function handleClockInReminders(
  supabase: any, 
  currentTime: string, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let sent = 0;
  
  console.log(`Processing clock-in reminders for ${currentTime}`);

  for (const worker of workers) {
    const notifType = `clock_in_${currentTime.replace(':', '')}_shift${worker.shift_start.replace(':', '')}`;
    
    // Check idempotency
    const alreadySent = await checkNotificationSent(supabase, worker.id, notifType, siteDate);
    if (alreadySent) {
      console.log(`Notification ${notifType} already sent to ${worker.name}`);
      continue;
    }

    // Check if already clocked in
    const clockedIn = await isWorkerClockedIn(supabase, worker.id, siteDate);
    if (clockedIn) {
      console.log(`Worker ${worker.name} already clocked in, canceling remaining clock-in reminders`);
      await cancelNotifications(supabase, worker.id, siteDate, `clock_in_.*_shift${worker.shift_start.replace(':', '')}`);
      continue;
    }

    // Dynamic message based on worker's shift_start
    const title = getClockInTitle(currentTime, worker.shift_start);
    const body = `Shift starts at ${worker.shift_start}. Please clock in.`;
    
    await sendNotification(supabase, worker.id, title, body, notifType, siteDate);
    await logNotification(supabase, worker.id, notifType, siteDate);
    
    sent++;
    console.log(`Sent clock-in reminder to ${worker.name} at ${currentTime} (shift: ${worker.shift_start})`);
  }

  return sent;
}

async function handleClockOutReminders(
  supabase: any, 
  currentTime: string, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let sent = 0;
  
  console.log(`Processing clock-out reminders for ${currentTime}`);

  for (const worker of workers) {
    const notifType = `clock_out_${currentTime.replace(':', '')}_shift${worker.shift_end.replace(':', '')}`;
    
    // Check idempotency
    const alreadySent = await checkNotificationSent(supabase, worker.id, notifType, siteDate);
    if (alreadySent) {
      console.log(`Notification ${notifType} already sent to ${worker.name}`);
      continue;
    }

    // Check if still clocked in
    const stillClockedIn = await isWorkerStillClockedIn(supabase, worker.id, siteDate);
    if (!stillClockedIn) {
      console.log(`Worker ${worker.name} already clocked out, canceling remaining clock-out reminders`);
      await cancelNotifications(supabase, worker.id, siteDate, `clock_out_.*_shift${worker.shift_end.replace(':', '')}`);
      continue;
    }

    // Dynamic message based on worker's shift_end
    const title = getClockOutTitle(currentTime, worker.shift_end);
    const body = `Shift ended at ${worker.shift_end}. Please clock out.`;
    
    await sendNotification(supabase, worker.id, title, body, notifType, siteDate);
    await logNotification(supabase, worker.id, notifType, siteDate);
    
    sent++;
    console.log(`Sent clock-out reminder to ${worker.name} at ${currentTime} (shift: ${worker.shift_end})`);
  }

  return sent;
}

async function handleAutoClockOut(
  supabase: any,
  currentTime: string, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let performed = 0;
  
  console.log(`\n========== AUTO CLOCK-OUT at ${currentTime} ==========`);
  console.log(`Processing ${workers.length} workers`);

  for (const worker of workers) {
    console.log(`\n--- Worker: ${worker.name} (shift_end: ${worker.shift_end}) ---`);
    
    // Check if audit already exists (idempotency)
    const auditExists = await checkAuditExists(supabase, worker.id, siteDate);
    if (auditExists) {
      console.log(`✓ Audit already exists - skipping`);
      continue;
    }

    // Get today's entry
    const entry = await getTodayEntry(supabase, worker.id, siteDate);
    if (!entry) {
      console.log(`No clock entry found`);
      await createAudit(supabase, worker.id, siteDate, false, 'NO_CLOCK_IN');
      continue;
    }
    
    console.log(`Clock entry: Found (${entry.id}, clocked_in: ${entry.clock_in}, clocked_out: ${entry.clock_out})`);
    
    // Run guard checks
    const checks = await runGuardChecks(supabase, worker.id, siteDate);
    console.log(`Guard checks: canAutoClockOut=${checks.canAutoClockOut}, reason=${checks.reason}`);
    
    if (!checks.canAutoClockOut) {
      console.log(`❌ Cannot auto clock-out: ${checks.reason}`);
      
      // Log audit with reason
      await createAudit(supabase, worker.id, siteDate, false, checks.reason);

      // If limit-related, send warning
      const limitReasons = ['CAP_MONTH', 'CAP_ROLLING14', 'CONSECUTIVE_BLOCK'];
      if (limitReasons.includes(checks.reason)) {
        await sendNotification(
          supabase,
          worker.id,
          '⚠️ Clock Out Now',
          'Auto clock-out disabled due to frequency limits. Please clock out manually.',
          'limit_warning'
        );
      }
      continue;
    }

    // Skip if already auto-clocked-out by geofence
    if (entry.auto_clockout_type === 'geofence') {
      console.log(`Worker ${worker.name} already auto-clocked-out by geofence, skipping time-based auto-clockout`);
      continue;
    }

    // Calculate clock-out time based on worker's shift_end + 30 minutes
    const [shiftHour, shiftMin] = worker.shift_end.split(':').map(Number);
    const clockOutTime = new Date(siteDate);
    // Add 30 minutes to shift end time
    const totalMinutes = shiftHour * 60 + shiftMin + 30;
    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;
    clockOutTime.setHours(newHour, newMin, 0, 0); // shift_end + 30 minutes

    const clockInTime = new Date(entry.clock_in);
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    console.log(`Performing auto clock-out at ${currentTime}: totalHours=${totalHours.toFixed(2)}`);

    const { error: updateError } = await supabase
      .from('clock_entries')
      .update({
        clock_out: clockOutTime.toISOString(),
        source: 'system_auto',
        photo_required: false,
        auto_clocked_out: true,
        auto_clockout_type: 'time_based',
        total_hours: totalHours,
        notes: `Auto clocked-out at ${currentTime} (30 minutes after ${worker.shift_end} shift end)`
      })
      .eq('id', entry.id);

    if (updateError) {
      console.error(`Error auto clocking out ${worker.name}:`, updateError);
      await createAudit(supabase, worker.id, siteDate, false, 'UNKNOWN');
      continue;
    }

    // Update counters
    await incrementCounters(supabase, worker.id, siteDate);

    // Log audit
    await createAudit(supabase, worker.id, siteDate, true, 'OK');

    // Send confirmation with worker's shift_end
    await sendNotification(
      supabase,
      worker.id,
      'Auto Clocked-Out',
      `You were auto clocked-out at ${currentTime} (30 minutes after ${worker.shift_end} shift end).`,
      'auto_clockout_confirm',
      siteDate
    );

    // Cancel any remaining clock-out reminders
    await cancelNotifications(supabase, worker.id, siteDate, `clock_out_.*_shift${worker.shift_end.replace(':', '')}`);

    performed++;
    console.log(`✅ Successfully auto clocked-out ${worker.name}`);
  }

  console.log(`\n========== AUTO CLOCK-OUT COMPLETE: ${performed} performed ==========\n`);
  return performed;
}

// ============================================================================
// Guard Checks
// ============================================================================

async function runGuardChecks(supabase: any, workerId: string, shiftDate: Date): Promise<GuardResult> {
  // 1. Check if clocked in today
  const entry = await getTodayEntry(supabase, workerId, shiftDate);
  if (!entry) {
    console.log(`  Guard: NO_CLOCK_IN - no entry found for date`);
    return { canAutoClockOut: false, reason: 'NO_CLOCK_IN' };
  }

  // 2. Check if already clocked out
  if (entry.clock_out) {
    console.log(`  Guard: ALREADY_CLOCKED_OUT - clock_out exists: ${entry.clock_out}`);
    return { canAutoClockOut: false, reason: 'ALREADY_CLOCKED_OUT' };
  }

  // 3. Get/create counter record
  const month = shiftDate.toISOString().slice(0, 7); // YYYY-MM
  const counter = await getOrCreateCounter(supabase, workerId, month);
  console.log(`  Guard: Counter check - monthly: ${counter.count_monthly}/3`);

  // 4. Check monthly cap (≤3)
  if (counter.count_monthly >= 3) {
    console.log(`  Guard: CAP_MONTH - monthly limit reached (${counter.count_monthly})`);
    return { canAutoClockOut: false, reason: 'CAP_MONTH' };
  }

  // 5. Check rolling 14-day cap (≤2)
  const rolling14Count = await getRolling14DayCount(supabase, workerId, shiftDate);
  console.log(`  Guard: Rolling 14-day check - count: ${rolling14Count}/2`);
  if (rolling14Count >= 2) {
    console.log(`  Guard: CAP_ROLLING14 - rolling 14-day limit reached (${rolling14Count})`);
    return { canAutoClockOut: false, reason: 'CAP_ROLLING14' };
  }

  // 6. Check consecutive workdays
  const yesterday = new Date(shiftDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayAudit = await getAudit(supabase, workerId, yesterday);
  if (yesterdayAudit?.performed) {
    const yesterdayDOW = yesterday.getDay();
    const weekdays = [1, 2, 3, 4, 5];
    // Only block if yesterday was also a weekday (consecutive workday)
    if (weekdays.includes(yesterdayDOW)) {
      console.log(`  Guard: CONSECUTIVE_BLOCK - auto clocked-out yesterday (${yesterday.toISOString().split('T')[0]})`);
      return { canAutoClockOut: false, reason: 'CONSECUTIVE_BLOCK' };
    }
  }

  console.log(`  Guard: OK - all checks passed`);
  return { canAutoClockOut: true, reason: 'OK' };
}

// ============================================================================
// Counter Management
// ============================================================================

async function getOrCreateCounter(supabase: any, workerId: string, month: string) {
  const { data: existing } = await supabase
    .from('auto_clockout_counters')
    .select('*')
    .eq('worker_id', workerId)
    .eq('month', month)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new counter
  const { data: newCounter } = await supabase
    .from('auto_clockout_counters')
    .insert({
      worker_id: workerId,
      month: month,
      count_monthly: 0,
      rolling14_count: 0
    })
    .select()
    .single();

  return newCounter || { count_monthly: 0, rolling14_count: 0 };
}

async function incrementCounters(supabase: any, workerId: string, shiftDate: Date) {
  const month = shiftDate.toISOString().slice(0, 7);
  
  const { error } = await supabase
    .from('auto_clockout_counters')
    .upsert({
      worker_id: workerId,
      month: month,
      count_monthly: supabase.raw('COALESCE(count_monthly, 0) + 1'),
      last_auto_clockout_at: new Date().toISOString(),
      last_workday_auto: shiftDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error incrementing counters:', error);
  }
}

async function getRolling14DayCount(supabase: any, workerId: string, shiftDate: Date): Promise<number> {
  const fourteenDaysAgo = new Date(shiftDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { count, error } = await supabase
    .from('auto_clockout_audit')
    .select('*', { count: 'exact', head: true })
    .eq('worker_id', workerId)
    .eq('performed', true)
    .gte('shift_date', fourteenDaysAgo.toISOString().split('T')[0]);

  if (error) {
    console.error('Error getting rolling 14 count:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// Audit Functions
// ============================================================================

async function checkAuditExists(supabase: any, workerId: string, shiftDate: Date): Promise<boolean> {
  const { data } = await supabase
    .from('auto_clockout_audit')
    .select('id')
    .eq('worker_id', workerId)
    .eq('shift_date', shiftDate.toISOString().split('T')[0])
    .maybeSingle();

  return !!data;
}

async function getAudit(supabase: any, workerId: string, shiftDate: Date) {
  const { data } = await supabase
    .from('auto_clockout_audit')
    .select('*')
    .eq('worker_id', workerId)
    .eq('shift_date', shiftDate.toISOString().split('T')[0])
    .maybeSingle();

  return data;
}

async function createAudit(
  supabase: any, 
  workerId: string, 
  shiftDate: Date, 
  performed: boolean, 
  reason: string
) {
  const { error } = await supabase
    .from('auto_clockout_audit')
    .insert({
      worker_id: workerId,
      shift_date: shiftDate.toISOString().split('T')[0],
      performed: performed,
      reason: reason,
      decided_at: new Date().toISOString(),
      decided_by: 'system'
    });

  if (error) {
    console.error('Error creating audit:', error);
  }
}

// ============================================================================
// Clock Entry Functions
// ============================================================================

async function getTodayEntry(supabase: any, workerId: string, siteDate: Date): Promise<ClockEntry | null> {
  // Extract date-only string (YYYY-MM-DD) to avoid timezone issues
  const dateOnly = siteDate.toISOString().split('T')[0];
  
  // Query for entries on this date (comparing dates in UTC)
  const { data } = await supabase
    .from('clock_entries')
    .select('id, clock_in, clock_out, job_id')
    .eq('worker_id', workerId)
    .gte('clock_in', `${dateOnly}T00:00:00.000Z`)
    .lt('clock_in', `${dateOnly}T23:59:59.999Z`)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function isWorkerClockedIn(supabase: any, workerId: string, siteDate: Date): Promise<boolean> {
  const entry = await getTodayEntry(supabase, workerId, siteDate);
  return !!entry;
}

async function isWorkerStillClockedIn(supabase: any, workerId: string, siteDate: Date): Promise<boolean> {
  const entry = await getTodayEntry(supabase, workerId, siteDate);
  return entry && !entry.clock_out;
}

// ============================================================================
// Notification Functions
// ============================================================================

async function checkNotificationSent(
  supabase: any, 
  workerId: string, 
  notifType: string, 
  siteDate: Date
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('worker_id', workerId)
    .eq('notification_type', notifType)
    .eq('shift_date', siteDate.toISOString().split('T')[0])
    .eq('canceled', false)
    .maybeSingle();

  return !!data;
}

async function logNotification(
  supabase: any, 
  workerId: string, 
  notifType: string, 
  siteDate: Date
) {
  await supabase
    .from('notification_log')
    .insert({
      worker_id: workerId,
      notification_type: notifType,
      shift_date: siteDate.toISOString().split('T')[0],
      sent_at: new Date().toISOString(),
      canceled: false
    });
}

async function cancelNotifications(
  supabase: any, 
  workerId: string, 
  siteDate: Date, 
  typePattern: string
) {
  // For patterns with regex, we need to fetch and filter
  const { data: logs } = await supabase
    .from('notification_log')
    .select('id, notification_type')
    .eq('worker_id', workerId)
    .eq('shift_date', siteDate.toISOString().split('T')[0])
    .eq('canceled', false);

  if (!logs || logs.length === 0) return;

  const regex = new RegExp(typePattern);
  const idsToCancel = logs
    .filter((log: any) => regex.test(log.notification_type))
    .map((log: any) => log.id);

  if (idsToCancel.length > 0) {
    await supabase
      .from('notification_log')
      .update({ canceled: true })
      .in('id', idsToCancel);
  }
}

async function sendNotification(
  supabase: any, 
  workerId: string, 
  title: string, 
  body: string, 
  type: string,
  shiftDate?: Date
) {
  try {
    // Generate dedupe key for idempotency
    const dateStr = shiftDate ? shiftDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dedupeKey = `${workerId}:${dateStr}:${type}`;

    // Check if already sent (idempotency)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();

    if (existing) {
      console.log(`Notification already sent: ${dedupeKey}`);
      return;
    }

    // Insert notification with dedupe key
    const { error } = await supabase
      .from('notifications')
      .insert({
        worker_id: workerId,
        title: title,
        body: body,
        type: type,
        dedupe_key: dedupeKey,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error sending notification:', error);
    } else {
      console.log(`Notification sent: ${type} to worker ${workerId}`);
    }
  } catch (error) {
    console.error('Error in sendNotification:', error);
  }
}

// ============================================================================
// Notification Templates (Updated for Dynamic Shifts)
// ============================================================================

function getClockInTitle(currentTime: string, shiftStart: string): string {
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  
  const [shiftHour, shiftMin] = shiftStart.split(':').map(Number);
  const shiftMinutes = shiftHour * 60 + shiftMin;
  
  const diff = currentMinutes - shiftMinutes;
  
  if (diff === -5) return '⏰ Shift Starting Soon';
  if (diff === 0) return '🌅 Shift Start Time';
  if (diff === 15) return '⚠️ Late Clock-In Reminder';
  
  return 'Clock In Reminder';
}

function getClockOutTitle(currentTime: string, shiftEnd: string): string {
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  
  const [shiftHour, shiftMin] = shiftEnd.split(':').map(Number);
  const shiftMinutes = shiftHour * 60 + shiftMin;
  
  const diff = currentMinutes - shiftMinutes;
  
  if (diff === 0) return '✅ Shift End Time';
  if (diff === 15) return '🏠 Time to Clock Out';
  
  return 'Clock Out Reminder';
}
