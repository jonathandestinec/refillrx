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

export async function scheduleRefillReminder(
  admin: AdminClient,
  { patientId, planId, nextRefillDate, reminderDays = 3 }: ScheduleRefillReminderInput,
) {
  const reminderDate = new Date(`${nextRefillDate}T00:00:00.000Z`);
  if (Number.isNaN(reminderDate.getTime())) {
    return new Error("The refill date is invalid.");
  }

  reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);

  const { data: existingReminder, error: lookupError } = await admin
    .from("notifications")
    .select("id")
    .eq("patient_id", patientId)
    .eq("refill_plan_id", planId)
    .eq("type", "refill_reminder")
    .maybeSingle<{ id: string }>();

  if (lookupError) return lookupError;

  const reminderPayload = {
    patient_id: patientId,
    refill_plan_id: planId,
    type: "refill_reminder",
    scheduled_for: reminderDate.toISOString(),
    sent_at: null,
    status: "scheduled",
  };

  return existingReminder
    ? (await admin.from("notifications").update(reminderPayload).eq("id", existingReminder.id)).error
    : (await admin.from("notifications").insert(reminderPayload)).error;
}
