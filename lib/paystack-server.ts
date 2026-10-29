import { createAdminClient } from "@/lib/supabase/admin";
import { MONTHLY_PLAN_PAYMENT } from "@/lib/payments";
import { scheduleRefillReminder } from "@/lib/refill-reminders";

type PaymentRow = {
  id: string;
  patient_id: string;
  plan_id: string | null;
  provider_reference: string | null;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
};

type PaystackVerification = {
  status?: boolean;
  message?: string;
  data?: {
    amount?: number;
    currency?: string;
    id?: number;
    reference?: string;
    status?: string;
  };
};

export type PaymentVerificationResult =
  | { ok: true; planId: string; status: "succeeded" }
  | { ok: false; status: "missing" | "pending" | "failed"; message: string };

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret key is not configured.");
  return secret;
}

export async function verifyAndActivatePayment(
  patientId: string,
  reference: string,
): Promise<PaymentVerificationResult> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, patient_id, plan_id, provider_reference, amount, currency, status, metadata")
    .eq("provider_reference", reference)
    .maybeSingle<PaymentRow>();

  if (!payment || payment.patient_id !== patientId) {
    return { ok: false, status: "missing", message: "We could not find that payment." };
  }

  if (payment.status === "succeeded" && payment.plan_id) {
    return { ok: true, planId: payment.plan_id, status: "succeeded" };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const verification = (await response.json()) as PaystackVerification;
  const transaction = verification.data;

  if (!response.ok || !verification.status || !transaction) {
    return { ok: false, status: "failed", message: "Paystack could not verify this payment." };
  }

  if (transaction.status !== "success") {
    const status = transaction.status === "pending" ? "pending" : "failed";
    if (status === "failed") {
      await admin.from("payments").update({
        status: "failed",
        metadata: { ...payment.metadata, paystack_status: transaction.status ?? "unknown" },
      }).eq("id", payment.id);
    }
    return {
      ok: false,
      status,
      message: status === "pending" ? "Payment is still being confirmed." : "The payment was not completed.",
    };
  }

  const amountMatches = transaction.amount === MONTHLY_PLAN_PAYMENT.amountMinor;
  const currencyMatches = (transaction.currency ?? "").toUpperCase() === MONTHLY_PLAN_PAYMENT.currency;
  if (!amountMatches || !currencyMatches) {
    await admin.from("payments").update({
      status: "failed",
      metadata: {
        ...payment.metadata,
        verification_error: "amount_or_currency_mismatch",
        paystack_amount: transaction.amount ?? null,
        paystack_currency: transaction.currency ?? null,
      },
    }).eq("id", payment.id);
    return { ok: false, status: "failed", message: "The payment details did not match the refill plan." };
  }

  const draftId = typeof payment.metadata.draft_id === "string" ? payment.metadata.draft_id : null;
  if (!draftId) return { ok: false, status: "failed", message: "This payment is missing its refill details." };

  const { data: draft } = await admin
    .from("refill_plan_drafts")
    .select("id, patient_id, medicine_id, instructions, frequency_days, next_refill_date")
    .eq("id", draftId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!draft) return { ok: false, status: "failed", message: "The saved refill details could not be found." };

  const { data: existingPlan } = await admin
    .from("refill_plans")
    .select("id, status")
    .eq("draft_id", draft.id)
    .maybeSingle<{ id: string; status: string }>();

  let planId = existingPlan?.id;
  if (!planId) {
    const { data: createdPlan, error } = await admin
      .from("refill_plans")
      .insert({
        draft_id: draft.id,
        patient_id: draft.patient_id,
        medicine_id: draft.medicine_id,
        instructions: draft.instructions,
        frequency_days: draft.frequency_days,
        next_refill_date: draft.next_refill_date,
        reminder_days: 3,
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (error && error.code !== "23505") {
      return { ok: false, status: "failed", message: "Payment was confirmed, but the refill plan could not be activated yet." };
    }
    planId = createdPlan?.id;
  }

  if (!planId) {
    const { data: retryPlan } = await admin
      .from("refill_plans")
      .select("id")
      .eq("draft_id", draft.id)
      .maybeSingle<{ id: string }>();
    planId = retryPlan?.id;
  }

  if (!planId) return { ok: false, status: "failed", message: "Payment was confirmed, but activation needs another try." };

  if (existingPlan && existingPlan.status !== "active") {
    const { error: activationError } = await admin
      .from("refill_plans")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("patient_id", patientId);

    if (activationError) {
      return { ok: false, status: "failed", message: "Payment was confirmed, but the refill plan could not be activated yet." };
    }
  }

  await admin.from("payments").update({
    plan_id: planId,
    status: "succeeded",
    paid_at: new Date().toISOString(),
    metadata: {
      ...payment.metadata,
      paystack_transaction_id: transaction.id ?? null,
      paystack_status: transaction.status,
      plan_id: planId,
    },
  }).eq("id", payment.id);

  const reminderError = await scheduleRefillReminder(admin, {
    patientId,
    planId,
    nextRefillDate: draft.next_refill_date,
  });
  if (reminderError) {
    console.error("Refill reminder scheduling failed", reminderError);
  }

  return { ok: true, planId, status: "succeeded" };
}
