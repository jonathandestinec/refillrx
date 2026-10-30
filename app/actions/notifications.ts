"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Marks the signed-in patient's unread notifications as read. Rows are only
// ever marked, never edited or deleted, so this stays inside the RLS update
// policy on notifications.
export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const patientId = claimsData?.claims?.sub;
  if (!patientId) redirect("/login");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("read_at", null);

  if (error) {
    console.error("Mark notifications read failed", { code: error.code, message: error.message });
    return;
  }
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
