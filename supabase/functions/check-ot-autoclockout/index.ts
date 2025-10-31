import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_OT_HOURS = 3;

interface ActiveOT {
  id: string;
  worker_id: string;
  job_id: string;
  clock_in: string;
  linked_shift_id: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    console.log('[OT Auto Clock-Out] Starting check at', now.toISOString());

    // Fetch all active OT sessions (no clock_out yet)
    const { data: activeOTs, error: fetchError } = await supabase
      .from('clock_entries')
      .select('id, worker_id, job_id, clock_in, linked_shift_id')
      .eq('is_overtime', true)
      .is('clock_out', null);

    if (fetchError) {
      console.error('[OT Auto Clock-Out] Error fetching active OTs:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch active OT entries',
          details: fetchError.message ?? JSON.stringify(fetchError),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!activeOTs || activeOTs.length === 0) {
      console.log('[OT Auto Clock-Out] No active OT entries found');
      return new Response(
        JSON.stringify({ message: 'No active OT entries', autoClockedOut: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[OT Auto Clock-Out] Found ${activeOTs.length} active OT entries`);
    let autoClockedOut = 0;

    for (const entry of activeOTs) {
      const clockInTime = new Date(entry.clock_in);
      const hoursWorked =
        (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      console.log(
        `[OT Auto Clock-Out] Entry ${entry.id}: ${hoursWorked.toFixed(
          2
        )} hours worked`
      );

      // Check 1️⃣: Geofence exit detected
      const { data: exitEvent } = await supabase
        .from('geofence_events')
        .select('id, event_type')
        .eq('clock_entry_id', entry.id)
        .eq('event_type', 'exit_detected')
        .is('resolved_at', null)
        .maybeSingle();

      if (exitEvent) {
        console.log(
          `[OT Auto Clock-Out] Entry ${entry.id}: Exit detected, auto-clocking out`
        );
        await autoClockOut(supabase, entry, 'Left job site during overtime');
        autoClockedOut++;
        continue;
      }

      // Check 2️⃣: 3-hour OT limit reached
      if (hoursWorked >= MAX_OT_HOURS) {
        console.log(
          `[OT Auto Clock-Out] Entry ${entry.id}: 3-hour limit reached, auto-clocking out`
        );
        await autoClockOut(supabase, entry, 'Maximum 3-hour OT limit reached');
        autoClockedOut++;
      }
    }

    console.log(
      `[OT Auto Clock-Out] Complete. Auto-clocked out ${autoClockedOut} entries`
    );

    return new Response(
      JSON.stringify({
        message: 'OT auto-clockout check complete',
        activeOTs: activeOTs.length,
        autoClockedOut,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[OT Auto Clock-Out] Unexpected error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function autoClockOut(
  supabase: any,
  entry: ActiveOT,
  reason: string
): Promise<void> {
  const clockOutTime = new Date().toISOString();

  try {
    // Calculate total OT hours
    const clockInTime = new Date(entry.clock_in);
    const clockOutDate = new Date(clockOutTime);
    const totalHours =
      (clockOutDate.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    console.log(
      `[Auto Clock-Out] Entry ${entry.id}: Setting clock_out to ${clockOutTime}, total hours: ${totalHours.toFixed(
        2
      )}`
    );

    // Update OT clock entry
    const { error: updateError } = await supabase
      .from('clock_entries')
      .update({
        clock_out: clockOutTime,
        auto_clocked_out: true,
        auto_clockout_reason: reason,
        total_hours: totalHours,
        notes: `Auto clocked-out OT (${reason})`,
      })
      .eq('id', entry.id);

    if (updateError) {
      console.error('[Auto Clock-Out] Error updating entry:', updateError);
      return;
    }

    // Resolve any unresolved exit_detected events for this OT entry
    await supabase
      .from('geofence_events')
      .update({ resolved_at: clockOutTime })
      .eq('clock_entry_id', entry.id)
      .eq('event_type', 'exit_detected')
      .is('resolved_at', null);

    // In-app notification
    const notificationTitle = 'Overtime Auto Clock-Out';
    const notificationBody = `You were automatically clocked out from your overtime.\nReason: ${reason}.`;

    const dedupeKey = `ot_auto_${entry.id}_${clockOutTime}`;

    await supabase.from('notifications').insert({
      worker_id: entry.worker_id,
      title: notificationTitle,
      body: notificationBody,
      type: 'overtime_auto_clockout',
      dedupe_key: dedupeKey,
      created_at: clockOutTime,
    });

    console.log(`[Auto Clock-Out] Entry ${entry.id}: Notification logged.`);

    // Push notification (optional; existing infra)
    await sendPushNotification(supabase, entry.worker_id, notificationTitle, notificationBody);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Auto Clock-Out] Error processing entry ${entry.id}:`, message);
  }
}

async function sendPushNotification(
  supabase: any,
  workerId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from('notification_preferences')
      .select('push_token')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (!data?.push_token) {
      console.log(`[Push] No push token found for worker ${workerId}`);
      return;
    }

    // Simulate push delivery (actual push service can be integrated here)
    console.log(`[Push] Sending to ${workerId}`, { title, body });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Push] Error sending push notification for ${workerId}:`, message);
  }
}
