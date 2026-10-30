"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type PlanDraftState = {
  message?: string;
  success?: boolean;
} | null;

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveRefillPlanDraft(
  _previousState: PlanDraftState,
  formData: FormData,
): Promise<PlanDraftState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const patientId = claimsData?.claims?.sub;

  if (!patientId) redirect("/login");

  const medicineId = getText(formData, "medicine_id");
  const frequencyDays = Number.parseInt(getText(formData, "frequency_days"), 10);
  const nextRefillDate = getText(formData, "next_refill_date");
  const instructions = getText(formData, "instructions");

  if (!medicineId || !Number.isInteger(frequencyDays) || frequencyDays < 1) {
    return { message: "Choose a medicine and refill frequency." };
  }

  if (!nextRefillDate) return { message: "Choose the next refill date." };
  const parsedDate = new Date(`${nextRefillDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate < today) {
    return { message: "Choose today or a future refill date." };
  }
  if (![28, 30, 60, 90].includes(frequencyDays)) {
    return { message: "Choose one of the supported refill frequencies." };
  }
  if (instructions.length > 500) return { message: "Keep instructions under 500 characters." };

  const { data: medicine } = await supabase
    .from("medicines")
    .select("id")
    .eq("id", medicineId)
    .eq("active", true)
    .maybeSingle();
  if (!medicine) return { message: "Choose an active medicine from the list." };

  const { error } = await supabase.from("refill_plan_drafts").insert({
    patient_id: patientId,
    medicine_id: medicineId,
    frequency_days: frequencyDays,
    next_refill_date: nextRefillDate,
    instructions: instructions || null,
  });

  if (error) return { message: "We could not save those refill details. Please try again." };

  return {
    success: true,
    message: "Your refill details are saved. Payment is required before the plan can be activated.",
  };
}
