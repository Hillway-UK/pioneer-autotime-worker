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
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { dateStr, timeHHmm, dayOfWeek } = nowInTz("Europe/London");
    const siteDate = new Date(`${dateStr}T00:00:00Z`);

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ message: "Weekend - skipped" }), {
        status: 200,
        headers: cors,
      });
    }

    let actions = 0;

    // Clock-In Reminders
    const clockInWorkers = await getWorkersForClockInReminder(supabase, timeHHmm, dayOfWeek);
    if (clockInWorkers.length) {
      actions += await handleClockInReminders(supabase, timeHHmm, siteDate, clockInWorkers);
    }

    // Clock-Out Reminders
    const clockOutWorkers = await getWorkersForClockOutReminder(supabase, timeHHmm, dayOfWeek);
    if (clockOutWorkers.length) {
      actions += await handleClockOutReminders(supabase, timeHHmm, siteDate, clockOutWorkers);
    }

    // Regular Auto Clockouts
    const autoClockoutWorkers = await getWorkersForAutoClockout(supabase, timeHHmm, dayOfWeek);
    if (autoClockoutWorkers.length) {
      actions += await handleAutoClockOut(supabase, timeHHmm, siteDate, autoClockoutWorkers);
    }

    // Overtime Auto Clockouts (3-hour limit)
    const otActions = await checkActiveOvertimeSessions(supabase, siteDate);
    actions += otActions;

    return new Response(
      JSON.stringify({
        message: "Check completed",
        actionsPerformed: actions,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-ot-autoclockout:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/* -------------------------------------------------------------------------- */
/*                            WORKER QUERY HELPERS                            */
/* -------------------------------------------------------------------------- */
async function getWorkersForClockInReminder(supabase, t, d) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_start) return false;
    const [sh, sm] = x.shift_start.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const diff = cur - sMin;
    return diff === -5 || diff === 0 || diff === 15;
  });
}

async function getWorkersForClockOutReminder(supabase, t, d) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_end) return false;
    const [eh, em] = x.shift_end.split(":").map(Number);
    const eMin = eh * 60 + em;
    const diff = cur - eMin;
    return diff === 0 || diff === 15;
  });
}

async function getWorkersForAutoClockout(supabase, t, d) {
  const [h, m] = t.split(":").map(Number);
  const cur = h * 60 + m;
  const { data: w } = await supabase
    .from("workers")
    .select("id,name,email,organization_id,shift_start,shift_end,shift_days")
    .eq("is_active", true);
  if (!w) return [];
  return w.filter((x) => {
    if (!x.shift_days?.includes(d)) return false;
    if (!x.shift_end) return false;
    const [eh, em] = x.shift_end.split(":").map(Number);
    const end = eh * 60 + em;
    return cur >= end + 30 && cur <= end + 40;
  });
}

/* -------------------------------------------------------------------------- */
/*                            REMINDER HANDLERS                               */
/* -------------------------------------------------------------------------- */
async function handleClockInReminders(supabase, t, date, workers) {
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

async function handleClockOutReminders(supabase, t, date, workers) {
  let sent = 0;
  for (const w of workers) {
    const notif = `clock_out_${t.replace(":", "")}_shift${w.shift_end.replace(":", "")}`;
    if (await checkNotificationSent(supabase, w.id, notif, date)) continue;

    const stillClocked = await isWorkerStillClockedIn(supabase, w.id, date);
    if (!stillClocked) continue;

    const { data: activeOT } = await supabase
      .from("clock_entries")
      .select("id")
      .eq("worker_id", w.id)
      .eq("is_overtime", true)
      .is("clock_out", null)
      .maybeSingle();
    if (activeOT) continue;

    const title = getClockOutTitle(t, w.shift_end);
    const body = `Shift ended at ${w.shift_end}. Please clock out.`;
    await sendNotification(supabase, w.id, title, body, notif, date);
    await logNotification(supabase, w.id, notif, date);
    sent++;
  }
  return sent;
}

/* -------------------------------------------------------------------------- */
/*                             AUTO CLOCKOUT (SHIFT)                          */
/* -------------------------------------------------------------------------- */
async function handleAutoClockOut(supabase, t, date, workers) {
  let performed = 0;
  for (const w of workers) {
    const latestEntry = await getTodayEntry(supabase, w.id, date);
    if (!latestEntry || latestEntry.clock_out) continue;

    const activeOT = await getActiveOTEntries(supabase, w.id);
    if (activeOT) continue;

    const [eh, em] = w.shift_end.split(":").map(Number);
    const clockOut = new Date(date);
    const totalMin = eh * 60 + em + 30;
    clockOut.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);

    const clockIn = new Date(latestEntry.clock_in);
    const totalHrs = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3.6e6);

    await supabase
      .from("clock_entries")
      .update({
        clock_out: clockOut.toISOString(),
        auto_clocked_out: true,
        auto_clockout_type: "time_based",
        total_hours: totalHrs,
        notes: `Auto clocked-out 30min after shift end ${w.shift_end}`,
      })
      .eq("id", latestEntry.id);
    performed++;

    const title = "Auto Clocked-Out - No Clock-Out Detected";
    const body = `You were automatically clocked out at ${w.shift_end} +30min.\nIf incorrect, please submit a Time Amendment request.`;
    await sendNotification(supabase, w.id, title, body, "auto_clockout_time", date);
    await logNotification(supabase, w.id, "auto_clockout_time", date);
    await sendPushNotification(supabase, w.id, title, body);
  }
  return performed;
}

/* -------------------------------------------------------------------------- */
/*                          OVERTIME AUTO CLOCKOUT (3h)                       */
/* -------------------------------------------------------------------------- */
async function checkActiveOvertimeSessions(supabase, date) {
  let clockedOut = 0;

  const { data: activeOTs } = await supabase
    .from("clock_entries")
    .select("id,worker_id,clock_in,job_id,is_overtime,status,auto_clocked_out")
    .eq("is_overtime", true)
    .is("clock_out", null)
    .eq("auto_clocked_out", false);

  if (!activeOTs?.length) return 0;

  for (const ot of activeOTs) {
    const now = new Date();
    const inTime = new Date(ot.clock_in);
    const hrs = (now.getTime() - inTime.getTime()) / 3.6e6;

    const { data: exits } = await supabase
      .from("geofence_events")
      .select("timestamp")
      .eq("clock_entry_id", ot.id)
      .eq("event_type", "exit_detected")
      .is("resolved_at", null)
      .order("timestamp", { ascending: false });

    if (exits?.length) {
      const exitTime = new Date(exits[exits.length - 1].timestamp);
      const graceMs = 5 * 60 * 1000;
      if (now.getTime() - exitTime.getTime() >= graceMs) {
        await autoClockOutOT(
          supabase,
          ot,
          date,
          `Left job site at ${exitTime.toLocaleTimeString("en-GB")} during overtime`,
          hrs
        );
        clockedOut++;
        continue;
      }
    }

    // 3-hour limit check
    if (hrs >= 3 && hrs <= 3.167) {
      await autoClockOutOT(
        supabase,
        ot,
        date,
        `3-hour OT limit reached (${hrs.toFixed(2)}h)`,
        3
      );
      clockedOut++;
      continue;
    }

    if (hrs > 3.167) {
      await autoClockOutOT(
        supabase,
        ot,
        date,
        `Exceeded 3-hour OT limit (${hrs.toFixed(2)}h) - catch-up`,
        3
      );
      clockedOut++;
    }
  }

  return clockedOut;
}

async function autoClockOutOT(supabase, ot, date, reason, forcedHours = null) {
  const now = new Date();
  const inTime = new Date(ot.clock_in);
  const actualHrs = (now.getTime() - inTime.getTime()) / 3.6e6;
  const totalHrs = forcedHours ?? Math.max(0, actualHrs);
  const cappedHrs = totalHrs > 3 ? 3 : totalHrs;

  await supabase
    .from("clock_entries")
    .update({
      clock_out: now.toISOString(),
      auto_clocked_out: true,
      auto_clockout_type: reason.includes("site") ? "geofence_based" : "time_based",
      total_hours: cappedHrs,
      notes: `Auto clocked-out: ${reason}`,
      status: "pending",
    })
    .eq("id", ot.id);

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
/*                                UTILITIES                                   */
/* -------------------------------------------------------------------------- */
async function getTodayEntry(supabase, id, date) {
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

async function isWorkerStillClockedIn(supabase, id, date) {
  const e = await getTodayEntry(supabase, id, date);
  return !!(e && !e.clock_out);
}

async function checkNotificationSent(supabase, id, type, date) {
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

async function sendNotification(supabase, id, title, body, type, date) {
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

async function logNotification(supabase, id, type, date) {
  await supabase.from("notification_log").insert({
    worker_id: id,
    notification_type: type,
    shift_date: date.toISOString().split("T")[0],
    sent_at: new Date().toISOString(),
    canceled: false,
  });
}

async function sendPushNotification(supabase, id, title, body) {
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
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: { token: data.push_token, title, body },
    });
    if (error) console.error(`Failed to send push notification to ${id}:`, error);
    else console.log(`✅ Push notification sent to worker ${id}: ${title}`);
  } catch (err) {
    console.error(`Error sending push notification to ${id}:`, err);
  }
}

function getClockInTitle(t, s) {
  const [ch, cm] = t.split(":").map(Number);
  const [sh, sm] = s.split(":").map(Number);
  const diff = ch * 60 +
