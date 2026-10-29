"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPharmacistId, logNotification, notifyUser } from "@/lib/push-server";
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
    // A 23505 here means another open order already exists for this plan.
    if (error.code === "23505") {
      return { message: "This refill is already in progress.", success: true };
    }
    console.error("Refill order creation failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { message: "We could not send the refill request. Please try again." };
  }

  // Let the pharmacist know a request just landed in the queue.
  const { data: medicine } = await supabase.from("medicines").select("name, strength").eq("id", plan.medicine_id).maybeSingle();
  const pharmacistId = await getPharmacistId();
  if (pharmacistId) {
    await notifyUser(pharmacistId, {
      title: "New refill request",
      body: `${medicine?.name ?? "A medicine"} refill request is waiting in the Mani queue.`,
      url: "/pharmacy",
    });
    const admin = createAdminClient();
    await logNotification(admin, {
      userId: pharmacistId,
      type: "order_update",
      title: "New refill request",
      body: `${medicine?.name ?? "A medicine"} refill request is waiting in the Mani queue.`,
      url: "/pharmacy",
    });
  }

  return { message: "Refill request sent to Mani.", success: true };
}

const allowedStatuses = ["requested", "reviewing", "ready", "completed", "cancelled"] as const;
type RefillOrderStatus = (typeof allowedStatuses)[number];
export type OrderStatusState = { message?: string; success?: boolean } | null;

// A refill order may only move forward through this chain (or be cancelled
// while it is still open). This keeps patients from tricks like re-opening a
// completed order and forces availability confirmation before pickup.
const allowedTransitions: Record<RefillOrderStatus, RefillOrderStatus[]> = {
  requested: ["reviewing", "cancelled"],
  reviewing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const statusPushCopy: Record<RefillOrderStatus, string> = {
  requested: "Your refill request has reached Mani.",
  reviewing: "Mani is reviewing your refill request.",
  ready: "Your refill is ready for pickup at Mani.",
  completed: "Your refill has been marked completed.",
  cancelled: "Your refill request was cancelled.",
};

async function loadActorProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return profile?.role ?? null;
}

export async function updateRefillOrderStatus(
  _previousState: OrderStatusState,
  formData: FormData,
): Promise<OrderStatusState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const role = await loadActorProfile(supabase, pharmacistId);
  if (role !== "pharmacist") redirect("/dashboard");

  const orderId = text(formData, "order_id");
  const nextStatus = text(formData, "status") as RefillOrderStatus;
  if (!orderId || !allowedStatuses.includes(nextStatus)) return { message: "That order status is not valid." };

  const { data: existingOrder } = await supabase
    .from("refill_orders")
    .select("patient_id, plan_id, status, availability_confirmed, private_price_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (!existingOrder) return { message: "That refill order could not be found." };

  const currentStatus = existingOrder.status as RefillOrderStatus;
  if (currentStatus === nextStatus && nextStatus === "completed") {
    return { message: "This refill is already marked completed.", success: true };
  }
  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    return { message: `A refill order in "${currentStatus.replace("_", " ")}" cannot move to "${nextStatus.replace("_", " ")}".` };
  }

  // Availability must be confirmed with a private price before the order is
  // either marked ready or completed, so pricing is never skipped.
  if ((nextStatus === "ready" || nextStatus === "completed") && (!existingOrder.availability_confirmed || existingOrder.private_price_amount === null)) {
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
    const body = statusPushCopy[nextStatus] ?? "There is an update about your refill.";
    await notifyUser(existingOrder.patient_id, { title: "RefillRx update", body, url: "/dashboard" });
    const admin = createAdminClient();
    await logNotification(admin, {
      userId: existingOrder.patient_id,
      type: "order_update",
      title: "RefillRx update",
      body,
      url: "/dashboard",
    });
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

export async function reviewRefillOrder(
  _previousState: OrderStatusState,
  formData: FormData,
): Promise<OrderStatusState> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const role = await loadActorProfile(supabase, pharmacistId);
  if (role !== "pharmacist") redirect("/dashboard");

  const orderId = text(formData, "order_id");
  const availability = text(formData, "availability");
  const priceText = text(formData, "private_price_amount");
  const price = Number(priceText);

  if (!orderId) return { message: "That refill order could not be found." };
  if (!["confirmed", "unavailable"].includes(availability)) return { message: "Choose an availability result first." };
  if (availability === "confirmed" && (!Number.isFinite(price) || price <= 0)) {
    return { message: "Enter the confirmed medicine price." };
  }

  const { data: order } = await supabase
    .from("refill_orders")
    .select("patient_id, plan_id, medicine_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { message: "That refill order could not be found." };

  const { data: medicine } = await supabase.from("medicines").select("reference_price_ngn").eq("id", order.medicine_id).maybeSingle();
  // Confirm the proposed price against the pharmacist-seeded reference price:
  // saving a review confirms the price the pharmacist actually checked.
  if (availability === "confirmed" && medicine?.reference_price_ngn != null && Math.abs(price - medicine.reference_price_ngn) > 0.009) {
    return { message: "The entered price does not match the reference price for this medicine." };
  }

  const updates: Record<string, unknown> = {
    availability_confirmed: availability === "confirmed",
    private_price_amount: availability === "confirmed" ? price : null,
    private_price_currency: "NGN",
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // "Unavailable" takes the request out of the queue. Otherwise a confirmed
  // review starts the review state so the queue never shows reviewed work as new.
  if (availability === "unavailable") {
    if (!["requested", "reviewing"].includes(order.status)) {
      return { message: "Only open requests can be marked unavailable." };
    }
    updates.status = "cancelled";
    updates.completed_at = new Date().toISOString();
  } else if (order.status === "requested") {
    updates.status = "reviewing";
  }

  const { error } = await supabase.from("refill_orders").update(updates).eq("id", orderId);
  if (error) {
    console.error("Refill order review failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    if (error.code === "23505") {
      return { message: "That refill order just changed. Refresh the queue and try again." };
    }
    return { message: "We could not save that review. Please try again." };
  }

  if (order.patient_id) {
    const body = availability === "confirmed"
      ? "Mani confirmed availability and set a private price on your refill."
      : "Mani could not source this medicine. Your request was cancelled; message Mani for alternatives.";
    await notifyUser(order.patient_id, { title: "RefillRx review update", body, url: "/dashboard" });
    const admin = createAdminClient();
    await logNotification(admin, {
      userId: order.patient_id,
      type: "order_update",
      title: "RefillRx review update",
      body,
      url: "/dashboard",
    });
  }

  return availability === "confirmed"
    ? { message: "Availability saved. Mark the order ready when it is packed.", success: true }
    : { message: "Request cancelled because the medicine is unavailable.", success: true };
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

  // Notify the other side of the conversation, never the sender: the patient is
  // on the order, and the pharmacist is the pharmacy's single pharmacist.
  const { data: order } = await supabase.from("refill_orders").select("patient_id").eq("id", orderId).maybeSingle();
  if (order) {
    const admin = createAdminClient();
    const preview = body.length > 90 ? `${body.slice(0, 90)}…` : body;
    if (senderId !== order.patient_id) {
      await notifyUser(order.patient_id, { title: "New message from Mani", body: preview, url: "/dashboard/messages" });
      await logNotification(admin, {
        userId: order.patient_id,
        type: "message",
        title: "New message from Mani",
        body: preview,
        url: "/dashboard/messages",
      });
    } else {
      const pharmacistId = await getPharmacistId();
      if (pharmacistId) {
        await notifyUser(pharmacistId, { title: "New patient message", body: preview, url: "/pharmacy/messages" });
        await logNotification(admin, {
          userId: pharmacistId,
          type: "message",
          title: "New patient message",
          body: preview,
          url: "/pharmacy/messages",
        });
      }
    }
  }

  return { message: "Message sent.", success: true, sentMessage };
}

// Marks every other party message in an order conversation as read. Called by
// the chat UI when the conversation is opened or a new message arrives.
export async function markOrderMessagesRead(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub;
  if (!viewerId) return;

  const orderId = text(formData, "order_id");
  if (!orderId) return;

  await supabase
    .from("refill_order_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .neq("sender_id", viewerId)
    .is("read_at", null);
}
