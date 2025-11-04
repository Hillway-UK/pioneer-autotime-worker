import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Utility: current time in Europe/London (handles DST)
function nowInTz(tz: string = "Europe/London") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const weekdayName = get("weekday");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dateStr: `${year}-${month}-${day}`,
    timeHHmm: `${get("hour")}:${get("minute")}`,
    dayOfWeek: map[weekdayName] || 0,
  };
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

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  job_id: string;
  is_overtime?: boolean;
  auto_clocked_out?: boolean;
  auto_clockout_type?: string | null;
  total_hours?: number | null;
  notes?: string | null;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { dateStr, timeHHmm, dayOfWeek } = nowInTz("Europe/London");
    const siteDate = new Date(`${dateStr}T00:00:00Z`);

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ message: "Weekend - skipped" }),
        { status: 200, headers: corsHeaders }
      );
    }

    let actions = 0;

    const clockInWorkers = await getWorkersForClockInReminder(
      supabase,
      timeHHmm,
      dayOfWeek
    );
    if (clockInWorkers.length) {
      actions += await handleClockInReminders(
        supabase,
        timeHHmm,
        siteDate,
        clockInWorkers
      );
    }

    const clockOutWorkers = await getWorkersForClockOutReminder(
      supabase,
      timeHHmm,
      dayOfWeek
    );
    if (clockOutWorkers.length) {
      actions += await handleClockOutReminders(
        supabase,
        timeHHmm,
        siteDate,
        clockOutWorkers
      );
    }

    const autoClockoutWorkers = await getWorkersForAutoClockout(
      supabase,
      timeHHmm,
      dayOfWeek
    );
    if (autoClockoutWorkers.length) {
      actions += await handleAutoClockOut(
        supabase,
        timeHHmm,
        siteDate,
        autoClockoutWorkers
      );
    }

    return new Response(
      JSON.stringify({
        message: "Check completed",
        actionsPerformed: actions,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in check-ot-autoclockout:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---------- Worker Query Helpers ----------

async function getWorkersForClockInReminder(supabase: any, t: string, d: number) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x: Worker) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_start) return false;
    const [sh, sm] = x.shift_start.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const diff = cur - sMin;
    return diff === -5 || diff === 0 || diff === 15;
  });
}

async function getWorkersForClockOutReminder(supabase: any, t: string, d: number) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x: Worker) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_end) return false;
    const [eh, em] = x.shift_end.split(":").map(Number);
    const eMin = eh * 60 + em;
    const diff = cur - eMin;
    return diff === 0 || diff === 15;
  });
}

async function getWorkersForAutoClockout(supabase: any, t: string, d: number) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x: Worker) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_end) return false;
    const [eh, em] = x.shift_end.split(":").map(Number);
    const end = eh * 60 + em;
    return cur >= end + 30 && cur <= end + 40;
  });
}

// ---------- Reminder Handlers ----------

async function handleClockInReminders(supabase: any, t: string, date: Date, workers: Worker[]) {
  let sent = 0;
  for (const w of workers) {
    const notif = `clock_in_${t.replace(":", "")}_shift${w.shift_start.replace(":", "")}`;
    if (await checkNotificationSent(supabase, w.id, notif, date)) continue;
    const entry = await getTodayEntry(supabase, w.id, date);
    if (entry) continue;
    const title = getClockInTitle(t, w.shift_start);
    const body = `Shift starts at ${w.shift_start}. Please clock in.`;
    await sendNotification(supabase, w.id, title, body, notif, date);
    await logNotification(supabase, w.id, notif, date);
    sent++;
  }
  return sent;
}

async function handleClockOutReminders(supabase: any, t: string, date: Date, workers: Worker[]) {
  let sent = 0;
  for (const w of workers) {
    const notif = `clock_out_${t.replace(":", "")}_shift${w.shift_end.replace(":", "")}`;
    if (await checkNotificationSent(supabase, w.id, notif, date)) continue;

    // Don't remind if not actually clocked in
    const stillClocked = await isWorkerStillClockedIn(supabase, w.id, date);
    if (!stillClocked) continue;

    // ✅ NEW: skip if worker has active OT
    const { data: activeOT } = await supabase
      .from("clock_entries")
      .select("id")
      .eq("worker_id", w.id)
      .eq("is_overtime", true)
      .is("clock_out", null)
      .maybeSingle();
    if (activeOT) {
      console.log(`Skipping clock-out reminder for ${w.name} (active OT)`);
      continue;
    }

    const title = getClockOutTitle(t, w.shift_end);
    const body = `Shift ended at ${w.shift_end}. Please clock out.`;
    await sendNotification(supabase, w.id, title, body, notif, date);
    await logNotification(supabase, w.id, notif, date);
    sent++;
  }
  return sent;
}

// ---------- Auto Clockout ----------

async function handleAutoClockOut(supabase: any, t: string, date: Date, workers: Worker[]) {
  let performed = 0;
  for (const w of workers) {
    // Latest entry today (could be base shift or OT depending on start times)
    const latestEntry = await getTodayEntry(supabase, w.id, date);
    if (!latestEntry) continue; // nothing to do

    // If latest entry already clocked out, nothing to do
    if (latestEntry.clock_out) continue;

    // Check active OT (separate entry)
    const activeOT = await getActiveOTEntries(supabase, w.id);

    if (activeOT) {
      // ✅ NEW: If OT has started but there is still an OPEN base shift entry today,
      // close that base shift at scheduled shift_end so OT is tracked separately.
      const openBase = await getOpenBaseShiftEntry(supabase, w.id, date);
      if (openBase) {
        const [eh, em] = w.shift_end.split(":").map(Number);
        const baseOut = new Date(date);
        const endMin = eh * 60 + em;
        baseOut.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

        const baseIn = new Date(openBase.clock_in);
        const baseHours = Math.max(0, (baseOut.getTime() - baseIn.getTime()) / 3.6e6);

        await supabase
          .from("clock_entries")
          .update({
            clock_out: baseOut.toISOString(),
            auto_clocked_out: true,
            auto_clockout_type: "shift_end_sync",
            total_hours: baseHours,
            notes: `Closed base shift at scheduled end ${w.shift_end} because OT started`,
          })
          .eq("id", openBase.id);

        // ✅ Send notification for base shift auto-clockout
        const title = "Base Shift Auto Clocked-Out";
        const body = `Your regular shift was automatically clocked out at ${w.shift_end} when you clocked in for overtime.`;
        await sendNotification(supabase, w.id, title, body, "auto_clockout_ot_start", date);
        await logNotification(supabase, w.id, "auto_clockout_ot_start", date);
        await sendPushNotification(supabase, w.id, title, body);

        performed++;
      }

      // ✅ OT auto clockout logic (3 hours or geofence exit)
      const handled = await handleOTAutoClockOut(supabase, date, t, w, activeOT);
      if (handled) performed++;
      continue; // IMPORTANT: Do not perform 30min auto clockout when OT active
    }

    // No active OT: proceed with normal 30-min auto clockout window
    const [eh, em] = w.shift_end.split(":").map(Number);
    const clockOut = new Date(date);
    const totalMin = eh * 60 + em + 30;
    clockOut.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);

    // Ensure we only act if the latest entry is indeed the base shift (non-OT)
    // and still open.
    const isBase = await isBaseShiftEntry(supabase, latestEntry.id);
    if (!isBase) continue;

    const clockIn = new Date(latestEntry.clock_in);
    const totalHrs = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3.6e6);

    await supabase.from("clock_entries").update({
      clock_out: clockOut.toISOString(),
      auto_clocked_out: true,
      auto_clockout_type: "time_based",
      total_hours: totalHrs,
      notes: `Auto clocked-out 30min after shift end ${w.shift_end}`,
    }).eq("id", latestEntry.id);
    performed++;

    const title = "Auto Clocked-Out - No Clock-Out Detected";
    const body =
      `You were automatically clocked out at ${w.shift_end} +30min.\nIf incorrect, please submit a Time Amendment request.`;
    await sendNotification(supabase, w.id, title, body, "auto_clockout_time", date);
    await logNotification(supabase, w.id, "auto_clockout_time", date);
    await sendPushNotification(supabase, w.id, title, body);
  }
  return performed;
}

// ---------- OT Auto Clockout ----------

async function getActiveOTEntries(supabase: any, workerId: string): Promise<ClockEntry | null> {
  const { data } = await supabase
    .from("clock_entries")
    .select("id,clock_in,clock_out,job_id,is_overtime")
    .eq("worker_id", workerId)
    .eq("is_overtime", true)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

async function handleOTAutoClockOut(supabase: any, date: Date, t: string, w: Worker, ot: ClockEntry) {
  const now = new Date();
  const inTime = new Date(ot.clock_in);
  const hrs = (now.getTime() - inTime.getTime()) / 3.6e6;
  const left = await hasLeftGeofence(supabase, w.id, ot.job_id);

  // Only auto clock-out OT if >= 3 hours or geofence left
  if (hrs < 3 && !left) return false;

  const reason = left ? "LEFT_GEOFENCE" : "OT_LIMIT_REACHED";

  await supabase.from("clock_entries").update({
    clock_out: now.toISOString(),
    auto_clocked_out: true,
    auto_clockout_type: reason === "LEFT_GEOFENCE" ? "geofence_based" : "ot_time_based",
    total_hours: Math.max(0, hrs),
    notes: reason === "LEFT_GEOFENCE"
      ? "Auto clocked-out (left site during OT)"
      : "Auto clocked-out after 3-hour OT period",
  }).eq("id", ot.id);

  const title =
    reason === "LEFT_GEOFENCE"
      ? "Auto Clocked-Out - Left Site During OT"
      : "Auto Clocked-Out - 3 Hour OT Limit Reached";
  const body =
    reason === "LEFT_GEOFENCE"
      ? "You were automatically clocked out for leaving the job site during OT."
      : "You were automatically clocked out after reaching the 3-hour OT limit.";

  // In-app (de-duped) + audit log + push
  await sendNotification(supabase, w.id, title, body, "ot_auto_clockout", date);
  await logNotification(supabase, w.id, "ot_auto_clockout", date);
  await sendPushNotification(supabase, w.id, title, body);

  return true;
}

async function hasLeftGeofence(supabase: any, workerId: string, jobId: string) {
  const { data } = await supabase
    .from("worker_tracking")
    .select("outside_geofence")
    .eq("worker_id", workerId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!data?.outside_geofence;
}

// ---------- Additional Helpers (NEW) ----------

async function getOpenBaseShiftEntry(supabase: any, workerId: string, date: Date): Promise<ClockEntry | null> {
  // Any non-OT, still-open entry today?
  const d = date.toISOString().split("T")[0];
  const { data } = await supabase
    .from("clock_entries")
    .select("id,clock_in,clock_out,job_id,is_overtime")
    .eq("worker_id", workerId)
    .eq("is_overtime", false)
    .is("clock_out", null)
    .gte("clock_in", `${d}T00:00:00Z`)
    .lt("clock_in", `${d}T23:59:59Z`)
    .order("clock_in", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function isBaseShiftEntry(supabase: any, entryId: string): Promise<boolean> {
  const { data } = await supabase
    .from("clock_entries")
    .select("is_overtime")
    .eq("id", entryId)
    .maybeSingle();
  return data ? data.is_overtime === false : false;
}

// ---------- Utility Functions ----------

async function getTodayEntry(supabase: any, id: string, date: Date): Promise<ClockEntry | null> {
  const d = date.toISOString().split("T")[0];
  const { data } = await supabase
    .from("clock_entries")
    .select("id,clock_in,clock_out,job_id,is_overtime")
    .eq("worker_id", id)
    .gte("clock_in", `${d}T00:00:00Z`)
    .lt("clock_in", `${d}T23:59:59Z`)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function isWorkerStillClockedIn(supabase: any, id: string, date: Date) {
  const e = await getTodayEntry(supabase, id, date);
  return !!(e && !e.clock_out);
}

async function checkNotificationSent(supabase: any, id: string, type: string, date: Date) {
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("worker_id", id)
    .eq("notification_type", type)
    .eq("shift_date", date.toISOString().split("T")[0])
    .eq("canceled", false)
    .maybeSingle();
  return !!data;
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

async function sendPushNotification(supabase: any, id: string, title: string, body: string) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("push_token")
    .eq("worker_id", id)
    .maybeSingle();
  if (!data?.push_token) {
    console.log(`No push token found for worker ${id}`);
    return;
  }
  
  try {
    // Call the push notification edge function
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { 
        token: data.push_token, 
        title, 
        body 
      }
    });
    
    if (error) {
      console.error(`Failed to send push notification to ${id}:`, error);
    } else {
      console.log(`✅ Push notification sent to worker ${id}: ${title}`);
    }
  } catch (err) {
    console.error(`Error sending push notification to ${id}:`, err);
  }
}

function getClockInTitle(t: string, s: string) {
  const [ch, cm] = t.split(":").map(Number);
  const [sh, sm] = s.split(":").map(Number);
  const diff = (ch * 60 + cm) - (sh * 60 + sm);
  if (diff === -5) return "⏰ Shift Starting Soon";
  if (diff === 0) return "🌅 Shift Start Time";
  if (diff === 15) return "⚠️ Late Clock-In Reminder";
  return "Clock In Reminder";
}

function getClockOutTitle(t: string, e: string) {
  const [ch, cm] = t.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const diff = (ch * 60 + cm) - (eh * 60 + em);
  if (diff === 0) return "✅ Shift End Time";
  if (diff === 15) return "🏠 Time to Clock Out";
  return "Clock Out Reminder";
}
