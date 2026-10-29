import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type ScheduleRefillReminderInput = {
  patientId: string;
  planId: string;
  nextRefillDate: string;
  reminderDays?: number;
};

export function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reminderDateFor(nextRefillDate: string, reminderDays: number) {
  const reminderDate = new Date(`${nextRefillDate}T00:00:00.000Z`);
  if (Number.isNaN(reminderDate.getTime())) return null;
  reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);
  return reminderDate.toISOString();
}

export async function scheduleRefillReminder(
  admin: AdminClient,
  { patientId, planId, nextRefillDate, reminderDays = 3 }: ScheduleRefillReminderInput,
) {
  const scheduledFor = reminderDateFor(nextRefillDate, reminderDays);
  if (!scheduledFor) {
    return new Error("The refill date is invalid.");
  }

  // The notifications table requires a title and body on every row. Reminders
  // are read back by the cron job, which sends this exact copy by push and email.
  const reminderPayload = {
    patient_id: patientId,
    refill_plan_id: planId,
    type: "refill_reminder" as const,
    title: "Refill reminder",
    body: "Your next refill is due in 3 days. Open RefillRx to request it.",
    scheduled_for: scheduledFor,
    sent_at: null,
    status: "scheduled",
    data: { reminder_days: reminderDays, next_refill_date: nextRefillDate },
  };

  // One reminder row per plan is enforced by the partial unique index
  // (refill_plan_id, type) where type = 'refill_reminder'. Re-arming after a
  // completed cycle overwrites the previous reminder, whether it was sent,
  // failed, or is still scheduled.
  const { data: existingReminder, error: lookupError } = await admin
    .from("notifications")
    .select("id")
    .eq("refill_plan_id", planId)
    .eq("type", "refill_reminder")
    .maybeSingle<{ id: string }>();

  if (lookupError) return lookupError;

  return existingReminder
    ? (await admin.from("notifications").update(reminderPayload).eq("id", existingReminder.id)).error
    : (await admin.from("notifications").insert(reminderPayload)).error;
}
