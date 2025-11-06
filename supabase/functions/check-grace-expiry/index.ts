/**
 * Supabase Edge Function: check-grace-expiry
 *
 * Runs via cron every 1–2 minutes.
 * Finds workers who left the geofence >5 minutes ago (4-min grace + 1-min buffer)
 * and automatically clocks them out if they never re-entered.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Timing thresholds
const GRACE_MINUTES = 4;
const RACE_BUFFER_SEC = 60;
const AUTO_DELAY_MS = (GRACE_MINUTES * 60 + RACE_BUFFER_SEC) * 1000; // 5 minutes total
const ACCURACY_PASS_M = 50; // Maximum accuracy for reliable location

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - AUTO_DELAY_MS).toISOString();

    console.log("=== CHECK-GRACE-EXPIRY INVOCATION ===");
    console.log("Cutoff:", cutoffTime);

    // Clean up stale exit_detected events older than 24 hours
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from("geofence_events")
      .delete()
      .eq("event_type", "exit_detected")
      .lt("timestamp", staleThreshold);

    if (cleanupError) {
      console.warn("Failed to clean up stale events:", cleanupError);
    } else {
      console.log("Cleaned up stale exit_detected events older than 24 hours");
    }

    // 1️⃣ Find exit_detected events older than 5 minutes that haven't been resolved
    const { data: exits, error: exitError } = await supabase
      .from("geofence_events")
      .select("id, worker_id, clock_entry_id, latitude, longitude, accuracy, distance_from_center, job_radius, safe_out_threshold, timestamp")
      .eq("event_type", "exit_detected")
      .lt("timestamp", cutoffTime)
      .gt("timestamp", staleThreshold); // Only process recent events

    if (exitError) throw exitError;
    if (!exits || exits.length === 0) {
      console.log("No expired exit_detected events to process.");
      return new Response(JSON.stringify({ status: "no_pending_exits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found ${exits.length} expired exits to review.`);

    for (const exit of exits) {
      console.log(`Processing clock_entry_id ${exit.clock_entry_id} for worker ${exit.worker_id}`);

      // 2️⃣ Check if already re-entered or confirmed
      const { data: existingEvents } = await supabase
        .from("geofence_events")
        .select("event_type")
        .eq("clock_entry_id", exit.clock_entry_id)
        .in("event_type", ["re_entry", "exit_confirmed"]);

      if (existingEvents && existingEvents.length > 0) {
        console.log(`Skipping ${exit.clock_entry_id} (already handled: ${existingEvents.map((e) => e.event_type).join(", ")})`);
        
        // Clean up this exit_detected event since it's been handled
        await supabase
          .from("geofence_events")
          .delete()
          .eq("id", exit.id);
        
        continue;
      }

      // 2b️⃣ Check if there are any location_fix events after the exit (worker re-entered)
      const { data: recentFixes } = await supabase
        .from("geofence_events")
        .select("id, distance_from_center, job_radius, accuracy")
        .eq("clock_entry_id", exit.clock_entry_id)
        .eq("event_type", "location_fix")
        .gt("timestamp", exit.timestamp);

      if (recentFixes && recentFixes.length > 0) {
        // Check if any of these fixes show the worker is back inside with reliable accuracy
        const backInside = recentFixes.some(fix => 
          fix.distance_from_center <= fix.job_radius && fix.accuracy <= ACCURACY_PASS_M
        );

        if (backInside) {
          console.log(`Worker re-entered geofence for ${exit.clock_entry_id}, recording re_entry event`);
          
          // Find the most recent fix that shows they're back inside
          const mostRecentFix = recentFixes.find(fix => 
            fix.distance_from_center <= fix.job_radius && fix.accuracy <= ACCURACY_PASS_M
          );

          await supabase.from("geofence_events").insert({
            worker_id: exit.worker_id,
            clock_entry_id: exit.clock_entry_id,
            shift_date: new Date().toISOString().split("T")[0],
            event_type: "re_entry",
            latitude: exit.latitude,
            longitude: exit.longitude,
            accuracy: mostRecentFix?.accuracy || exit.accuracy,
            distance_from_center: mostRecentFix?.distance_from_center || exit.distance_from_center,
            job_radius: exit.job_radius,
            safe_out_threshold: exit.safe_out_threshold,
            timestamp: new Date().toISOString(),
          });

          // Clean up this exit_detected event since it's been handled
          await supabase
            .from("geofence_events")
            .delete()
            .eq("id", exit.id);

          continue;
        }
      }

      // 3️⃣ Check if manual clock-out happened or if this is an OT entry
      const { data: clockEntry } = await supabase
        .from("clock_entries")
        .select("clock_out, auto_clocked_out, clock_in, is_overtime")
        .eq("id", exit.clock_entry_id)
        .single();

      if (!clockEntry) {
        console.log(`Clock entry not found for ${exit.clock_entry_id}`);
        continue;
      }

      // Skip OT entries - they are handled by check-clock-status with 3-hour limit
      if (clockEntry.is_overtime) {
        console.log(`Skipping ${exit.clock_entry_id} (OT entry - handled by check-clock-status).`);
        continue;
      }

      if (clockEntry.clock_out && !clockEntry.auto_clocked_out) {
        console.log(`Skipping ${exit.clock_entry_id} (manual clockout detected).`);
        continue;
      }

      // 4️⃣ Auto-clock-out the worker
      const clockOutTime = new Date(exit.timestamp);
      const totalHours =
        (clockOutTime.getTime() - new Date(clockEntry.clock_in).getTime()) /
        (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from("clock_entries")
        .update({
          clock_out: clockOutTime.toISOString(),
          clock_out_lat: exit.latitude,
          clock_out_lng: exit.longitude,
          auto_clocked_out: true,
          auto_clockout_type: "geofence",
          total_hours: totalHours,
          geofence_exit_data: {
            distance: exit.distance_from_center,
            accuracy: exit.accuracy,
            threshold: exit.safe_out_threshold,
            radius: exit.job_radius,
          },
          notes: `Auto clocked-out by geofence exit at ${clockOutTime.toLocaleTimeString()} (left job site)`,
        })
        .eq("id", exit.clock_entry_id)
        .is("clock_out", null);

      if (updateError) {
        console.error(`Failed to update clock entry ${exit.clock_entry_id}:`, updateError);
        continue;
      }

      // 5️⃣ Record exit_confirmed
      await supabase.from("geofence_events").insert({
        worker_id: exit.worker_id,
        clock_entry_id: exit.clock_entry_id,
        shift_date: new Date(clockEntry.clock_in).toISOString().split("T")[0],
        event_type: "exit_confirmed",
        latitude: exit.latitude,
        longitude: exit.longitude,
        accuracy: exit.accuracy,
        distance_from_center: exit.distance_from_center,
        job_radius: exit.job_radius,
        safe_out_threshold: exit.safe_out_threshold,
        timestamp: clockOutTime.toISOString(),
      });

      // Clean up the original exit_detected event
      await supabase
        .from("geofence_events")
        .delete()
        .eq("id", exit.id);

      // 6️⃣ Send notification
      const clockOutTimeFormatted = clockOutTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const clockOutDateFormatted = clockOutTime.toLocaleDateString("en-GB");
      const clockOutDate = clockOutTime.toISOString().split("T")[0];
      const dedupeKey = `${exit.worker_id}:${clockOutDate}:auto_clockout_geofence`;

      const notificationTitle = "Auto Clocked-Out - Left Job Site";
      const notificationBody = `You were automatically clocked out at ${clockOutTimeFormatted} on ${clockOutDateFormatted}.\n\nReason: You left the job site geofence area within 1 hour before your scheduled shift end time. Your location was detected ${exit.distance_from_center.toFixed(0)}m from the site center (threshold: ${exit.safe_out_threshold}m).\n\nIf this timestamp is incorrect or you did not leave the site, please submit a Time Amendment request in the app.`;

      await supabase.from("notifications").insert({
        worker_id: exit.worker_id,
        title: notificationTitle,
        body: notificationBody,
        type: "geofence_auto_clockout",
        dedupe_key: dedupeKey,
        created_at: new Date().toISOString(),
      });

      console.log(`✅ Auto-clockout completed for ${exit.worker_id} (${exit.clock_entry_id})`);
    }

    return new Response(JSON.stringify({ status: "processed", count: exits.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in check-grace-expiry:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
