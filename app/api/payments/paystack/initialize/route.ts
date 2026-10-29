import { connection } from "next/server";
import { NextResponse } from "next/server";

import { createPaymentReference, MONTHLY_PLAN_PAYMENT } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function POST() {
  await connection();
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ message: "Payments are not configured for this environment yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.id) return NextResponse.json({ message: "Sign in before starting payment." }, { status: 401 });
  if (!user.email) return NextResponse.json({ message: "Your account needs an email before payment can start." }, { status: 400 });

  const { data: draft } = await supabase
    .from("refill_plan_drafts")
    .select("id, expires_at, patient_id, medicine_id, instructions, frequency_days, next_refill_date")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) return NextResponse.json({ message: "Save your refill details before paying." }, { status: 400 });
  if (new Date(draft.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ message: "These saved refill details have expired. Please register them again." }, { status: 400 });
  }

  const admin = createAdminClient();
  // The payments table requires a monthly payment to point at a plan. Reserve
  // the draft as an inactive plan first; successful verification activates it.
  // This keeps payment-before-registration semantics at the product level
  // while giving the payment record a valid database target.
  const { data: savedPlan, error: savedPlanError } = await admin
    .from("refill_plans")
    .select("id, status")
    .eq("draft_id", draft.id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string; status: string }>();

  if (savedPlanError) {
    console.error("Paystack plan reservation lookup failed", {
      code: savedPlanError.code,
      message: savedPlanError.message,
      details: savedPlanError.details,
    });
    return NextResponse.json({ message: "We could not prepare the payment. Please try again." }, { status: 500 });
  }

  let planId = savedPlan?.id;
  if (!planId) {
    const { data: reservedPlan, error: reserveError } = await admin
      .from("refill_plans")
      .insert({
        draft_id: draft.id,
        patient_id: draft.patient_id,
        medicine_id: draft.medicine_id,
        instructions: draft.instructions,
        frequency_days: draft.frequency_days,
        next_refill_date: draft.next_refill_date,
        reminder_days: 3,
        status: "paused",
      })
      .select("id")
      .single<{ id: string }>();

    if (reserveError && reserveError.code !== "23505") {
      console.error("Paystack plan reservation failed", {
        code: reserveError.code,
        message: reserveError.message,
        details: reserveError.details,
        hint: reserveError.hint,
      });
      return NextResponse.json({ message: "We could not prepare the payment. Please try again." }, { status: 500 });
    }

    planId = reservedPlan?.id;
  }

  if (!planId) {
    const { data: retryPlan } = await admin
      .from("refill_plans")
      .select("id")
      .eq("draft_id", draft.id)
      .eq("patient_id", user.id)
      .maybeSingle<{ id: string }>();
    planId = retryPlan?.id;
  }

  if (!planId) {
    return NextResponse.json({ message: "We could not prepare the payment. Please try again." }, { status: 500 });
  }

  const { data: existingPayment, error: existingPaymentError } = await admin
    .from("payments")
    .select("id, provider_reference, metadata")
    .eq("patient_id", user.id)
    .eq("status", "pending")
    .contains("metadata", { draft_id: draft.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPaymentError) {
    console.error("Paystack payment lookup failed", {
      code: existingPaymentError.code,
      message: existingPaymentError.message,
      details: existingPaymentError.details,
    });
    return NextResponse.json({ message: "We could not prepare the payment. Please try again." }, { status: 500 });
  }

  const reference = existingPayment?.provider_reference ?? createPaymentReference();
  let paymentId = existingPayment?.id;
  let metadata = (existingPayment?.metadata ?? {}) as Record<string, unknown>;

  if (!paymentId) {
    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        patient_id: user.id,
        plan_id: planId,
        kind: MONTHLY_PLAN_PAYMENT.kind,
        provider: "paystack",
        provider_reference: reference,
        amount: MONTHLY_PLAN_PAYMENT.amount,
        currency: MONTHLY_PLAN_PAYMENT.currency,
        status: "pending",
        metadata: { draft_id: draft.id, amount_minor: MONTHLY_PLAN_PAYMENT.amountMinor },
      })
      .select("id, provider_reference, metadata")
      .single();
    if (error || !payment) {
      console.error("Paystack payment record creation failed", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse.json({ message: "We could not prepare the payment. Please try again." }, { status: 500 });
    }
    paymentId = payment.id;
    metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  }

  if (typeof metadata.authorization_url === "string" && typeof metadata.access_code === "string") {
    return NextResponse.json({
      accessCode: metadata.access_code,
      authorizationUrl: metadata.authorization_url,
      reference,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: String(MONTHLY_PLAN_PAYMENT.amountMinor),
      currency: MONTHLY_PLAN_PAYMENT.currency,
      reference,
      callback_url: `${siteUrl}/auth/payment/callback`,
      metadata: { draft_id: draft.id, payment_id: paymentId },
    }),
    cache: "no-store",
  });
  const result = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: { access_code?: string; authorization_url?: string; reference?: string };
  };

  if (!response.ok || !result.status || !result.data?.access_code || !result.data.authorization_url) {
    console.error("Paystack checkout initialization failed", {
      httpStatus: response.status,
      message: result.message,
      reference,
      providerStatus: result.status,
    });
    await admin.from("payments").update({
      status: "failed",
      metadata: { ...metadata, initialize_error: true, initialize_message: result.message ?? null },
    }).eq("id", paymentId);
    return NextResponse.json({ message: "Paystack could not start checkout. Please try again." }, { status: 502 });
  }

  await admin.from("payments").update({
    metadata: {
      ...metadata,
      access_code: result.data.access_code,
      authorization_url: result.data.authorization_url,
    },
  }).eq("id", paymentId);

  return NextResponse.json({
    accessCode: result.data.access_code,
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference ?? reference,
  });
}
