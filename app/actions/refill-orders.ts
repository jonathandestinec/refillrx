"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPatient } from "@/lib/push-server";
import { addDaysToDate, scheduleRefillReminder } from "@/lib/refill-reminders";

export type RefillOrderState = { message?: string; success?: boolean } | null;
export type MessageState = { message?: string; success?: boolean; sentMessage?: { id: string; sender_id: string; body: string; created_at: string } } | null;

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
export type OrderStatusState = { message?: string; success?: boolean } | null;

export async function updateRefillOrderStatus(
  _previousState: OrderStatusState,
  formData: FormData,
): Promise<OrderStatusState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", pharmacistId).maybeSingle();
  if (profile?.role !== "pharmacist") redirect("/dashboard");

  const orderId = text(formData, "order_id");
  const nextStatus = text(formData, "status") as RefillOrderStatus;
  if (!orderId || !allowedStatuses.includes(nextStatus)) return { message: "That order status is not valid." };

  const { data: existingOrder } = await supabase
    .from("refill_orders")
    .select("patient_id, plan_id, status, availability_confirmed, private_price_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (!existingOrder) return { message: "That refill order could not be found." };
  if (nextStatus === "completed" && existingOrder.status === "completed") {
    return { message: "This refill is already marked completed.", success: true };
  }
  if (nextStatus === "ready" && (!existingOrder.availability_confirmed || existingOrder.private_price_amount === null)) {
    return { message: "Save the availability and private price before marking this order ready." };
  }

  const updates: Record<string, string> = { status: nextStatus, updated_at: new Date().toISOString() };
  if (nextStatus === "ready") updates.ready_at = new Date().toISOString();
  if (nextStatus === "completed") updates.completed_at = new Date().toISOString();

  const { error } = await supabase.from("refill_orders").update(updates).eq("id", orderId);
  if (error) {
    console.error("Refill order status update failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return { message: "We could not update this refill order. Please try again." };
  }
  if (existingOrder.patient_id) {
    const message = nextStatus === "reviewing"
      ? "Mani is reviewing your refill request."
      : nextStatus === "ready"
        ? "Your refill is ready for pickup at Mani."
        : nextStatus === "completed"
          ? "Your refill has been marked completed."
          : "Your refill request was cancelled.";
    await notifyPatient(existingOrder.patient_id, { title: "RefillRx update", body: message, url: "/dashboard" });
  }

  if (nextStatus === "completed" && existingOrder.plan_id) {
    const admin = createAdminClient();
    const { data: plan, error: planLookupError } = await admin
      .from("refill_plans")
      .select("id, patient_id, next_refill_date, frequency_days, reminder_days")
      .eq("id", existingOrder.plan_id)
      .eq("patient_id", existingOrder.patient_id)
      .maybeSingle<{ id: string; patient_id: string; next_refill_date: string; frequency_days: number; reminder_days: number | null }>();

    if (planLookupError || !plan) {
      console.error("Completed refill plan lookup failed", planLookupError);
    } else {
      const nextRefillDate = addDaysToDate(plan.next_refill_date, plan.frequency_days);
      if (!nextRefillDate) {
        console.error("Completed refill plan has an invalid next refill date", { planId: plan.id });
      } else {
        const { error: planUpdateError } = await admin
          .from("refill_plans")
          .update({ next_refill_date: nextRefillDate, updated_at: new Date().toISOString() })
          .eq("id", plan.id)
          .eq("patient_id", plan.patient_id);

        if (planUpdateError) {
          console.error("Next refill date update failed", planUpdateError);
        } else {
          const reminderError = await scheduleRefillReminder(admin, {
            patientId: plan.patient_id,
            planId: plan.id,
            nextRefillDate,
            reminderDays: plan.reminder_days ?? 3,
          });
          if (reminderError) console.error("Next refill reminder scheduling failed", reminderError);
        }
      }
    }
  }
  return { message: nextStatus === "completed" ? "Refill marked completed." : "Order status updated.", success: true };
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

  const { data: order } = await supabase.from("refill_orders").select("patient_id").eq("id", orderId).maybeSingle();
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

  if (!error && order?.patient_id) {
    const body = availability === "confirmed"
      ? "Mani confirmed availability and added a private price to your refill."
      : "Mani could not confirm availability for this refill. Open RefillRx for details.";
    await notifyPatient(order.patient_id, { title: "RefillRx review update", body, url: "/dashboard" });
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

  const { data: sentMessage, error } = await supabase
    .from("refill_order_messages")
    .insert({ order_id: orderId, sender_id: senderId, body })
    .select("id, sender_id, body, created_at")
    .single();
  if (error) {
    console.error("Order message creation failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return { message: "We could not send that message. Please try again." };
  }

  const { data: order } = await supabase.from("refill_orders").select("patient_id").eq("id", orderId).maybeSingle();
  if (!error && order?.patient_id) {
    await notifyPatient(order.patient_id, { title: "New message from Mani", body, url: "/dashboard" });
  }

  return { message: "Message sent.", success: true, sentMessage };
}
