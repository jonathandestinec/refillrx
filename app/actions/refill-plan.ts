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
  const frequencyValue = getText(formData, "frequency_days");
  const frequencyDays = Number(frequencyValue);
  const nextRefillDate = getText(formData, "next_refill_date");
  const instructions = getText(formData, "instructions");

  if (!medicineId || !["28", "30", "60", "90"].includes(frequencyValue) || ![28, 30, 60, 90].includes(frequencyDays)) {
    return { message: "Choose a medicine and refill frequency." };
  }

  const dateParts = nextRefillDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateParts) return { message: "Choose a valid next refill date." };
  const parsedDate = new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])));
  if (parsedDate.toISOString().slice(0, 10) !== nextRefillDate) {
    return { message: "Choose a valid next refill date." };
  }
  const todayInBenin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Lagos" }).format(new Date());
  if (nextRefillDate < todayInBenin) {
    return { message: "The next refill date cannot be in the past." };
  }
  if (instructions.length > 500) return { message: "Keep instructions under 500 characters." };

  const { data: medicine, error: medicineError } = await supabase
    .from("medicines")
    .select("id")
    .eq("id", medicineId)
    .eq("active", true)
    .maybeSingle();
  if (medicineError) {
    console.error("Refill plan medicine lookup failed", { code: medicineError.code, message: medicineError.message });
    return { message: "We could not verify that medicine. Please try again." };
  }
  if (!medicine) return { message: "Choose a medicine from the available list." };

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
