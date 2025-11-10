import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------------------------------------------------------------- */
/*                               TIME UTILITIES                               */
/* -------------------------------------------------------------------------- */
function nowInTz(tz = "Europe/London") {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayName = get("weekday");
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    timeHHmm: `${get("hour")}:${get("minute")}`,
    dayOfWeek: map[weekdayName] || 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                                EDGE HANDLER                                */
/* -------------------------------------------------------------------------- */
serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { dateStr, timeHHmm, dayOfWeek } = nowInTz("Europe/London");
    const siteDate = new Date(`${dateStr}T00:00:00Z`);

    if (dayOfWeek === 0 || dayOfWeek === 6)
      return new Response(JSON.stringify({ message: "Weekend - skipped" }), {
        status: 200,
        headers: cors,
      });

    let actions = 0;
    actions += await checkActiveOvertimeSessions(supabase, siteDate);

    return new Response(
      JSON.stringify({
        message: "Check completed",
        actionsPerformed: actions,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                    FORCE OT AUTO-CLOCKOUT (> 3 HOURS)                      */
/* -------------------------------------------------------------------------- */
async function checkActiveOvertimeSessions(supabase: any, date: Date) {
  let clockedOut = 0;

  const { data: activeOTs, error } = await supabase
    .from("clock_entries")
    .select("id,worker_id,clock_in,job_id,is_overtime")
    .eq("is_overtime", true)
    .is("clock_out", null);

  if (error) {
    console.error("❌ Failed to fetch OT entries:", error);
    return 0;
  }
  if (!activeOTs?.length) return 0;

  console.log(`🔍 Found ${activeOTs.length} active OT sessions`);

  for (const ot of activeOTs) {
    try {
      const now = new Date();
      const inTime = new Date(ot.clock_in);
      const hrs = (now.getTime() - inTime.getTime()) / 3.6e6;

      // ----- check geofence exits -----
      const { data: exits } = await supabase
        .from("geofence_events")
        .select("id,timestamp")
        .eq("clock_entry_id", ot.id)
        .eq("event_type", "exit_detected")
        .is("resolved_at", null)
        .order("timestamp", { ascending: false });

      if (exits?.length) {
        const exitTime = new Date(exits[exits.length - 1].timestamp);
        if (now.getTime() - exitTime.getTime() >= 5 * 60 * 1000) {
          await autoClockOutOT(
            supabase,
            ot,
            date,
            `Left job site at ${exitTime.toLocaleTimeString("en-GB")} during overtime`,
          );
          clockedOut++;
          continue;
        }
      }

      // ----- force clock-out if > 3 hours -----
      if (hrs > 3) {
        await autoClockOutOT(supabase, ot, date, `Exceeded 3-hour OT limit (${hrs.toFixed(2)}h)`);
        clockedOut++;
      }
    } catch (err) {
      console.error(`❌ Error handling OT entry ${ot.id}:`, err);
    }
  }

  console.log(`✅ Auto-clocked-out ${clockedOut} OT entries`);
  return clockedOut;
}

/* -------------------------------------------------------------------------- */
/*                           AUTO-CLOCKOUT HANDLER                            */
/* -------------------------------------------------------------------------- */
async function autoClockOutOT(supabase: any, ot: any, date: Date, reason: string) {
  const now = new Date();
  const inTime = new Date(ot.clock_in);
  const totalHrs = (now.getTime() - inTime.getTime()) / 3.6e6;

  console.log(`⏱️  Clocking out OT entry ${ot.id} (${totalHrs.toFixed(2)}h)`);

  const { data: updated, error: updateError } = await supabase
    .from("clock_entries")
    .update({
      clock_out: now.toISOString(),
      auto_clocked_out: true,
      auto_clockout_type: reason.includes("site") ? "geofence_based" : "ot_time_based",
      total_hours: Math.max(0, totalHrs),
      notes: `Auto clocked-out: ${reason}`,
    })
    .eq("id", ot.id)
    .select();

  if (updateError) {
    console.error(`❌ Failed to update clock_entry ${ot.id}:`, updateError);
    return;
  }
  if (!updated?.length) {
    console.error(`⚠️  No matching clock_entry found for id ${ot.id}`);
    return;
  }

  console.log(`✅ Updated clock_entry ${ot.id}`);

  // mark geofence events as resolved
  await supabase
    .from("geofence_events")
    .update({ resolved_at: now.toISOString() })
    .eq("clock_entry_id", ot.id)
    .eq("event_type", "exit_detected")
    .is("resolved_at", null);

  const title = reason.includes("site")
    ? "Auto Clocked-Out - Left Site During OT"
    : "Auto Clocked-Out - 3 Hour OT Limit Reached";
  const body = `You were automatically clocked out from overtime. ${reason}`;

  await sendNotification(supabase, ot.worker_id, title, body, "ot_auto_clockout", date);
  await logNotification(supabase, ot.worker_id, "ot_auto_clockout", date);
  await sendPushNotification(supabase, ot.worker_id, title, body);
}

/* -------------------------------------------------------------------------- */
/*                                NOTIFICATIONS                               */
/* -------------------------------------------------------------------------- */
async function sendNotification(supabase: any, id: string, title: string, body: string, type: string, date: Date) {
  const key = `${id}:${date.toISOString().split("T")[0]}:${type}`;
  const { data: ex } = await supabase.from("notifications").select("id").eq("dedupe_key", key).maybeSingle();
  if (ex) return;
  await supabase.from("notifications").insert({
    worker_id: id,
    title,
    body,
    type,
    dedupe_key: key,
    created_at: new Date().toISOString(),
  });
}

async function logNotification(supabase: any, id: string, type: string, date: Date) {
  await supabase.from("notification_log").insert({
    worker_id: id,
    notification_type: type,
    shift_date: date.toISOString().split("T")[0],
    sent_at: new Date().toISOString(),
    canceled: false,
  });
}

async function sendPushNotification(supabase: any, id: string, title: string, body: string) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("push_token")
    .eq("worker_id", id)
    .maybeSingle();

  if (!data?.push_token) {
    console.log(`ℹ️  No push token found for worker ${id}`);
    return;
  }

  try {
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: { token: data.push_token, title, body },
    });
    if (error) console.error(`❌ Push send failed for ${id}:`, error);
    else console.log(`📨 Push notification sent to ${id}: ${title}`);
  } catch (err) {
    console.error(`❌ Push invoke error for ${id}:`, err);
  }
}
