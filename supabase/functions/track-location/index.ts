import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safe-out thresholds based on geofence radius
const SAFE_OUT_TABLE: Record<number, number> = {
  50: 90,
  100: 150,
  200: 260,
  300: 380,
  400: 500,
  500: 625,
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: LocationPayload = await req.json();
    console.log("=== TRACK-LOCATION INVOCATION ===", {
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      accuracy: payload.accuracy,
      timestamp: payload.timestamp,
    });

    // 1. Validate worker is clocked in
    const { data: clockEntry, error: entryError } = await supabase
      .from("clock_entries")
      .select("*, jobs(latitude, longitude, geofence_radius, geofence_enabled), is_overtime")
      .eq("id", payload.clock_entry_id)
      .eq("worker_id", payload.worker_id)
      .is("clock_out", null)
      .single();

    if (entryError || !clockEntry) {
      console.log("Worker not clocked in or entry not found");
      return new Response(JSON.stringify({ status: "not_clocked_in" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log("Clock entry found:", {
      clock_in: clockEntry.clock_in,
      job_name: clockEntry.jobs?.name,
      job_radius: clockEntry.jobs?.geofence_radius,
      is_overtime: clockEntry.is_overtime || false,
    });

    // 2. Get job details
    const job = clockEntry.jobs;
    if (!job || !job.latitude || !job.longitude || !job.geofence_radius) {
      console.error("Invalid job data");
      return new Response(JSON.stringify({ error: "Invalid job data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2a. Skip geofence exit detection if geofence is disabled
    if (job.geofence_enabled === false) {
      console.log("Geofence disabled for this job - skipping exit detection, only logging location");
      
      // Still record location fix for audit trail
      const shiftDate = new Date(clockEntry.clock_in).toISOString().split("T")[0];
      await supabase.from("geofence_events").insert({
        worker_id: payload.worker_id,
        clock_entry_id: payload.clock_entry_id,
        shift_date: shiftDate,
        event_type: "location_fix",
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        distance_from_center: 0, // Not applicable when geofence disabled
        job_radius: job.geofence_radius,
        safe_out_threshold: 0,
        timestamp: payload.timestamp,
      });

      return new Response(JSON.stringify({ status: "geofence_disabled", message: "Location logged, no exit detection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Calculate distance from site center
    const distance = calculateDistance(payload.latitude, payload.longitude, job.latitude, job.longitude);

    // 4. Get safe-out threshold
    const threshold = getSafeOutThreshold(job.geofence_radius);

    console.log("Distance calculation:", {
      distance: distance.toFixed(2),
      threshold: threshold,
      radius: job.geofence_radius,
      isOutside: distance > job.geofence_radius,
    });

    // 5. Record location fix event
    const shiftDate = new Date(clockEntry.clock_in).toISOString().split("T")[0];
    await supabase.from("geofence_events").insert({
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      shift_date: shiftDate,
      event_type: "location_fix",
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      distance_from_center: distance,
      job_radius: job.geofence_radius,
      safe_out_threshold: threshold,
      timestamp: payload.timestamp,
    });

    // 6. Check if this is overtime OR in last hour window
    const isOvertime = clockEntry.is_overtime === true;
    
    if (!isOvertime) {
      // For regular shifts, only check geofence in last hour window
      const { data: worker } = await supabase.from("workers").select("shift_end").eq("id", payload.worker_id).single();

      if (!worker || !worker.shift_end) {
        console.log("Worker shift_end not found");
        return new Response(JSON.stringify({ status: "no_shift_end" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // --- SHIFT END VALIDATION (Unified) ---
      const shiftEndRaw = worker.shift_end?.trim();

      if (!shiftEndRaw) {
        console.error("Missing shift_end");
        return new Response(JSON.stringify({ status: "no_shift_end" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Use the robust parser to support HH:MM, HH:MM:SS, or 12h AM/PM
      const parsedShiftEnd = parseShiftEnd(shiftEndRaw);
      if (!parsedShiftEnd) {
        console.error("Invalid shift_end format:", shiftEndRaw);
        return new Response(
          JSON.stringify({
            status: "invalid_shift_end",
            error: "shift_end must be in HH:MM, HH:MM:SS, or h:mm AM/PM format",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          },
        );
      }

      const normalizedShiftEnd = `${String(parsedShiftEnd.hour).padStart(2, "0")}:${String(parsedShiftEnd.minute).padStart(2, "0")}`;
      const isInLastHour = checkLastHourWindow(clockEntry.clock_in, normalizedShiftEnd);

      console.log("Last hour window result:", {
        isInLastHour,
        worker_shift_end: normalizedShiftEnd,
        clock_in: clockEntry.clock_in,
      });

      if (!isInLastHour) {
        console.log("Not in last hour window for regular shift");
        return new Response(JSON.stringify({ status: "outside_window", distance, threshold }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } else {
      console.log("Overtime session detected - always checking geofence");
    }

    // 7. Check if reliable exit
    const isExit = reliableExit(distance, payload.accuracy, job.geofence_radius, threshold);

    console.log("Reliable exit check:", {
      isExit,
      distance,
      accuracy: payload.accuracy,
      threshold,
    });

    if (!isExit) {
      console.log("Not a reliable exit");
      return new Response(JSON.stringify({ status: "inside_fence", distance, threshold }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log("EXIT DETECTED! Recording exit event...");

    // 8. Record exit detected - cron job will handle the rest
    await supabase.from("geofence_events").insert({
      worker_id: payload.worker_id,
      clock_entry_id: payload.clock_entry_id,
      shift_date: shiftDate,
      event_type: "exit_detected",
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      distance_from_center: distance,
      job_radius: job.geofence_radius,
      safe_out_threshold: threshold,
      timestamp: payload.timestamp,
    });

    console.log("Exit detected event recorded. Cron job will process auto-clockout after grace period.");

    return new Response(
      JSON.stringify({
        status: "exit_detected",
        message: "Exit recorded. Auto-clockout will be processed by cron job after grace period.",
        distance,
        threshold,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in track-location:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function getSafeOutThreshold(radius: number): number {
  return SAFE_OUT_TABLE[radius] || radius * 1.25;
}

function reliableExit(distance: number, accuracy: number, radius: number, threshold: number): boolean {
  // A) Overshoot rule: clearly beyond fence
  if (distance >= threshold) return true;

  // B) Accuracy-aware margin: good fix with smaller overshoot
  if (accuracy <= ACCURACY_PASS_M && distance >= radius + Math.max(25, accuracy / 2)) {
    return true;
  }

  return false;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function parseShiftEnd(shiftEnd: string): { hour: number; minute: number } | null {
  const s = shiftEnd.trim().toLowerCase();

  // 24h format: HH:MM or HH:MM:SS
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
    return null;
  }

  // 12h format: h[:mm] AM/PM
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    const meridiem = m[3];
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  return null;
}

function checkLastHourWindow(clockInIso: string, shiftEnd: string): boolean {
  const now = new Date();

  const parsed = parseShiftEnd(shiftEnd);
  if (!parsed) {
    console.error("Invalid shift_end format in checkLastHourWindow:", shiftEnd);
    return false;
  }

  // CRITICAL FIX: Create shift end datetime for TODAY (current date), not clockIn date
  // This ensures the check works correctly even if worker stays clocked in overnight
  const shiftEndTime = new Date();
  shiftEndTime.setHours(parsed.hour, parsed.minute, 0, 0);

  // Calculate last hour window start (shift_end - 60 minutes)
  const windowStart = new Date(shiftEndTime.getTime() - AUTO_WINDOW_MINUTES * 60 * 1000);

  console.log("Last hour window check:", {
    now: now.toISOString(),
    windowStart: windowStart.toISOString(),
    shiftEndTime: shiftEndTime.toISOString(),
    isInWindow: now >= windowStart && now <= shiftEndTime,
  });

  // Check if current time is within the window
  return now >= windowStart && now <= shiftEndTime;
}

async function sendPushNotification(supabase: any, workerId: string, title: string, body: string) {
  try {
    // Get worker's push token
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_token")
      .eq("worker_id", workerId)
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
    console.log("Push notification payload:", { title, body, token: prefs.push_token });
  } catch (error) {
    console.error("Error sending push notification:", error);
    // Don't throw - push notifications are optional
  }
}
