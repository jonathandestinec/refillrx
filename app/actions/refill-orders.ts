"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type RefillOrderState = { message?: string; success?: boolean } | null;
export type MessageState = { message?: string; success?: boolean } | null;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestRefill(
  _previousState: RefillOrderState,
  formData: FormData,
): Promise<RefillOrderState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const patientId = claimsData?.claims?.sub;
  if (!patientId) redirect("/login");

  const planId = text(formData, "plan_id");
  if (!planId) return { message: "We could not identify that refill plan." };

  const { data: plan } = await supabase
    .from("refill_plans")
    .select("id, patient_id, medicine_id, instructions, next_refill_date, status")
    .eq("id", planId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) return { message: "That refill plan is no longer active." };

  const { data: existingOrder } = await supabase
    .from("refill_orders")
    .select("id, status")
    .eq("plan_id", plan.id)
    .eq("patient_id", patientId)
    .in("status", ["requested", "reviewing", "ready"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingOrder) {
    return { message: "This refill is already in progress.", success: true };
  }

  const { error } = await supabase.from("refill_orders").insert({
    patient_id: patientId,
    plan_id: plan.id,
    medicine_id: plan.medicine_id,
    patient_note: plan.instructions,
    requested_for: plan.next_refill_date,
    status: "requested",
  });

  if (error) {
    console.error("Refill order creation failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { message: "We could not send the refill request. Please try again." };
  }

  return { message: "Refill request sent to Mani.", success: true };
}

const allowedStatuses = ["requested", "reviewing", "ready", "completed", "cancelled"] as const;
type RefillOrderStatus = (typeof allowedStatuses)[number];

export async function updateRefillOrderStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", pharmacistId).maybeSingle();
  if (profile?.role !== "pharmacist") redirect("/dashboard");

  const orderId = text(formData, "order_id");
  const nextStatus = text(formData, "status") as RefillOrderStatus;
  if (!orderId || !allowedStatuses.includes(nextStatus)) return;

  const { data: order } = await supabase
    .from("refill_orders")
    .select("availability_confirmed, private_price_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (nextStatus === "ready" && (!order?.availability_confirmed || order.private_price_amount === null)) return;

  const updates: Record<string, string> = { status: nextStatus, updated_at: new Date().toISOString() };
  if (nextStatus === "ready") updates.ready_at = new Date().toISOString();
  if (nextStatus === "completed") updates.completed_at = new Date().toISOString();

  await supabase.from("refill_orders").update(updates).eq("id", orderId);
}

export async function reviewRefillOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", pharmacistId).maybeSingle();
  if (profile?.role !== "pharmacist") redirect("/dashboard");

  const orderId = text(formData, "order_id");
  const availability = text(formData, "availability");
  const priceText = text(formData, "private_price_amount");
  const price = Number(priceText);

  if (!orderId || !["confirmed", "unavailable"].includes(availability)) return;
  if (availability === "confirmed" && (!Number.isFinite(price) || price < 0)) return;

  const { error } = await supabase.from("refill_orders").update({
    availability_confirmed: availability === "confirmed",
    private_price_amount: availability === "confirmed" ? price : null,
    private_price_currency: "NGN",
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", orderId);

  if (error) {
    console.error("Refill order review failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return;
  }

}

export async function sendOrderMessage(
  _previousState: MessageState,
  formData: FormData,
): Promise<MessageState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const senderId = claimsData?.claims?.sub;
  if (!senderId) redirect("/login");

  const orderId = text(formData, "order_id");
  const body = text(formData, "body");
  if (!orderId || !body) return { message: "Write a message before sending." };
  if (body.length > 1000) return { message: "Keep messages under 1,000 characters." };

  const { error } = await supabase.from("refill_order_messages").insert({ order_id: orderId, sender_id: senderId, body });
  if (error) {
    console.error("Order message creation failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return { message: "We could not send that message. Please try again." };
  }

  return { message: "Message sent.", success: true };
}
