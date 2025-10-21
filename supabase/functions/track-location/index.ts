import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe-out thresholds based on geofence radius
const SAFE_OUT_TABLE: Record<number, number> = {
  50: 90,
  100: 150,
  200: 260,
  300: 380,
  400: 500,
  500: 625
};

const GRACE_MINUTES = 4;
const RACE_BUFFER_SEC = 60;
const ACCURACY_PASS_M = 50;
const AUTO_WINDOW_MINUTES = 60;

interface LocationPayload {
  worker_id: string;
  clock_entry_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: LocationPayload = await req.json();
    console.log('=== TRACK-LOCATION INVOCATION ===', {
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      accuracy: payload.accuracy,
      timestamp: payload.timestamp
    });

    // 1. Validate worker is clocked in
    const { data: clockEntry, error: entryError } = await supabase
      .from('clock_entries')
      .select('*, jobs(latitude, longitude, geofence_radius)')
      .eq('id', payload.clock_entry_id)
      .eq('worker_id', payload.worker_id)
      .is('clock_out', null)
      .single();

    if (entryError || !clockEntry) {
      console.log('Worker not clocked in or entry not found');
      return new Response(JSON.stringify({ status: 'not_clocked_in' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Clock entry found:', {
      clock_in: clockEntry.clock_in,
      job_name: clockEntry.jobs?.name,
      job_radius: clockEntry.jobs?.geofence_radius
    });

    // 2. Get job details
    const job = clockEntry.jobs;
    if (!job || !job.latitude || !job.longitude || !job.geofence_radius) {
      console.error('Invalid job data');
      return new Response(JSON.stringify({ error: 'Invalid job data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 3. Calculate distance from site center
    const distance = calculateDistance(
      payload.latitude,
      payload.longitude,
      job.latitude,
      job.longitude
    );

    // 4. Get safe-out threshold
    const threshold = getSafeOutThreshold(job.geofence_radius);

    console.log('Distance calculation:', {
      distance: distance.toFixed(2),
      threshold: threshold,
      radius: job.geofence_radius,
      isOutside: distance > job.geofence_radius
    });

    // 5. Record location fix event
    const shiftDate = new Date(clockEntry.clock_in).toISOString().split('T')[0];
    await supabase.from('geofence_events').insert({
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      shift_date: shiftDate,
      event_type: 'location_fix',
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      distance_from_center: distance,
      job_radius: job.geofence_radius,
      safe_out_threshold: threshold,
      timestamp: payload.timestamp
    });

    // 6. Check if in last hour window
    const { data: worker } = await supabase
      .from('workers')
      .select('shift_end')
      .eq('id', payload.worker_id)
      .single();

    if (!worker || !worker.shift_end) {
      console.log('Worker shift_end not found');
      return new Response(JSON.stringify({ status: 'no_shift_end' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Validate shift_end format
    if (!/^\d{2}:\d{2}$/.test(worker.shift_end)) {
      console.error('Invalid shift_end format:', worker.shift_end);
      return new Response(JSON.stringify({ 
        status: 'invalid_shift_end',
        error: 'shift_end must be in HH:MM format'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const isInLastHour = checkLastHourWindow(clockEntry.clock_in, worker.shift_end);
    
    console.log('Last hour window result:', {
      isInLastHour,
      worker_shift_end: worker.shift_end,
      clock_in: clockEntry.clock_in
    });
    
    if (!isInLastHour) {
      console.log('Not in last hour window');
      return new Response(JSON.stringify({ status: 'outside_window', distance, threshold }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 7. Check if reliable exit
    const isExit = reliableExit(distance, payload.accuracy, job.geofence_radius, threshold);
    
    console.log('Reliable exit check:', {
      isExit,
      distance,
      accuracy: payload.accuracy,
      threshold
    });

    if (!isExit) {
      console.log('Not a reliable exit');
      return new Response(JSON.stringify({ status: 'inside_fence', distance, threshold }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('EXIT DETECTED! Grace period starting...', {
      grace_minutes: GRACE_MINUTES,
      will_check_at: new Date(Date.now() + GRACE_MINUTES * 60 * 1000).toISOString()
    });
    
    // 8. Record exit detected
    await supabase.from('geofence_events').insert({
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      shift_date: shiftDate,
      event_type: 'exit_detected',
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      distance_from_center: distance,
      job_radius: job.geofence_radius,
      safe_out_threshold: threshold,
      timestamp: payload.timestamp
    });

    // 9. Wait for grace period (4 minutes) - check for re-entry
    await new Promise(resolve => setTimeout(resolve, GRACE_MINUTES * 60 * 1000));

    console.log('Grace period complete. Checking for re-entry...');

    // Check if worker re-entered
    const { data: reentryEvents } = await supabase
      .from('geofence_events')
      .select('*')
      .eq('clock_entry_id', payload.clock_entry_id)
      .eq('event_type', 'location_fix')
      .gte('timestamp', payload.timestamp)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (reentryEvents && reentryEvents.length > 0) {
      const reenteredInside = reentryEvents.some(e => e.distance_from_center < job.geofence_radius);
      if (reenteredInside) {
        console.log('Worker re-entered during grace period');
        await supabase.from('geofence_events').insert({
          worker_id: payload.worker_id,
          clock_entry_id: payload.clock_entry_id,
          shift_date: shiftDate,
          event_type: 're_entry',
          latitude: reentryEvents[0].latitude,
          longitude: reentryEvents[0].longitude,
          accuracy: reentryEvents[0].accuracy,
          distance_from_center: reentryEvents[0].distance_from_center,
          job_radius: job.geofence_radius,
          safe_out_threshold: threshold,
          timestamp: reentryEvents[0].timestamp
        });
        return new Response(JSON.stringify({ status: 're_entered' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    console.log('No re-entry detected. Waiting for race buffer...');

    // 10. Wait for race buffer (60 seconds)
    await new Promise(resolve => setTimeout(resolve, RACE_BUFFER_SEC * 1000));

    // Check if manual clock-out happened
    const { data: updatedEntry } = await supabase
      .from('clock_entries')
      .select('clock_out, auto_clocked_out')
      .eq('id', payload.clock_entry_id)
      .single();

    if (updatedEntry?.clock_out && !updatedEntry.auto_clocked_out) {
      console.log('Manual clock-out detected, skipping auto-clock-out');
      return new Response(JSON.stringify({ status: 'manual_clockout' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 11. Perform auto-clock-out
    const clockOutTime = new Date(payload.timestamp);
    const clockInTime = new Date(clockEntry.clock_in);
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    console.log('Performing auto-clockout...', {
      clock_out_time: clockOutTime.toISOString(),
      total_hours: totalHours.toFixed(2)
    });

    const { error: updateError } = await supabase
      .from('clock_entries')
      .update({
        clock_out: clockOutTime.toISOString(),
        clock_out_lat: payload.latitude,
        clock_out_lng: payload.longitude,
        auto_clocked_out: true,
        auto_clockout_type: 'geofence',
        geofence_exit_data: {
          distance: distance,
          accuracy: payload.accuracy,
          threshold: threshold,
          radius: job.geofence_radius
        },
        total_hours: totalHours,
        notes: `Auto clocked-out by geofence exit at ${clockOutTime.toLocaleTimeString()} (left job site)`
      })
      .eq('id', payload.clock_entry_id)
      .is('clock_out', null);

    if (updateError) {
      console.error('Error updating clock entry:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to auto-clock-out' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // 12. Record exit confirmed
    await supabase.from('geofence_events').insert({
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      shift_date: shiftDate,
      event_type: 'exit_confirmed',
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      distance_from_center: distance,
      job_radius: job.geofence_radius,
      safe_out_threshold: threshold,
      timestamp: clockOutTime.toISOString()
    });

    // 13. Send notification
    const clockOutTimeFormatted = clockOutTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const clockOutDateFormatted = clockOutTime.toLocaleDateString('en-GB');
    // Use date-based dedupe key to prevent multiple auto-clockout notifications per day
    const clockOutDate = clockOutTime.toISOString().split('T')[0];
    const dedupeKey = `${payload.worker_id}:${clockOutDate}:auto_clockout_geofence`;
    
    const notificationTitle = 'Auto Clocked-Out - Left Job Site';
    const notificationBody = `You were automatically clocked out at ${clockOutTimeFormatted} on ${clockOutDateFormatted}.\n\nReason: You left the job site geofence area within 1 hour before your scheduled shift end time. Your location was detected ${distance.toFixed(0)}m from the site center (threshold: ${threshold}m).\n\nIf this timestamp is incorrect or you did not leave the site, please submit a Time Amendment request in the app.`;
    
    await supabase.from('notifications').insert({
      worker_id: payload.worker_id,
      title: notificationTitle,
      body: notificationBody,
      type: 'geofence_auto_clockout',
      dedupe_key: dedupeKey,
      created_at: new Date().toISOString()
    });

    // Also send push notification
    await sendPushNotification(supabase, payload.worker_id, notificationTitle, notificationBody);

    console.log('Geofence auto-clock-out completed successfully');

    return new Response(JSON.stringify({ 
      status: 'auto_clocked_out',
      clock_out_time: clockOutTime.toISOString(),
      total_hours: totalHours
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in track-location:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function getSafeOutThreshold(radius: number): number {
  return SAFE_OUT_TABLE[radius] || radius * 1.25;
}

function reliableExit(
  distance: number,
  accuracy: number,
  radius: number,
  threshold: number
): boolean {
  // A) Overshoot rule: clearly beyond fence
  if (distance >= threshold) return true;

  // B) Accuracy-aware margin: good fix with smaller overshoot
  if (accuracy <= ACCURACY_PASS_M && distance >= (radius + Math.max(25, accuracy / 2))) {
    return true;
  }

  return false;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function checkLastHourWindow(clockInIso: string, shiftEnd: string): boolean {
  const now = new Date();
  
  // Parse shift_end time (HH:MM format)
  const [shiftHour, shiftMin] = shiftEnd.split(':').map(Number);
  
  // CRITICAL FIX: Create shift end datetime for TODAY (current date), not clockIn date
  // This ensures the check works correctly even if worker stays clocked in overnight
  const shiftEndTime = new Date();
  shiftEndTime.setHours(shiftHour, shiftMin, 0, 0);
  
  // Calculate last hour window start (shift_end - 60 minutes)
  const windowStart = new Date(shiftEndTime.getTime() - AUTO_WINDOW_MINUTES * 60 * 1000);
  
  console.log('Last hour window check:', {
    now: now.toISOString(),
    windowStart: windowStart.toISOString(),
    shiftEndTime: shiftEndTime.toISOString(),
    isInWindow: now >= windowStart && now <= shiftEndTime
  });
  
  // Check if current time is within the window
  return now >= windowStart && now <= shiftEndTime;
}

async function sendPushNotification(
  supabase: any,
  workerId: string,
  title: string,
  body: string
) {
  try {
    // Get worker's push token
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_token')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (!prefs?.push_token) {
      console.log(`No push token found for worker ${workerId}`);
      return;
    }

    // Send push notification via service worker
    // Note: This is a best-effort attempt - if it fails, the in-app notification will still work
    console.log(`Sending push notification to worker ${workerId}`);
    
    // In a real implementation, you would use a push notification service here
    // For now, we'll just log it
    console.log('Push notification payload:', { title, body, token: prefs.push_token });
    
  } catch (error) {
    console.error('Error sending push notification:', error);
    // Don't throw - push notifications are optional
  }
}
