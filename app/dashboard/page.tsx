import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import BrandMark from "@/app/components/brand-mark";
import OrderChat from "@/app/components/order-chat";
import PushNotificationOptIn from "@/app/components/push-notification-opt-in";
import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

import PaymentCheckout from "./payment-checkout";
import RequestRefill from "./request-refill";

export const instant = false;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default async function DashboardPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profile?.role === "pharmacist") redirect("/pharmacy");

  const { data: activePlan } = await supabase
    .from("refill_plans")
    .select("id, medicine_id, frequency_days, next_refill_date, status")
    .eq("patient_id", claims.sub)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: activeMedicine } = activePlan
    ? await supabase
        .from("medicines")
        .select("name, brand, strength, dosage_form")
        .eq("id", activePlan.medicine_id)
        .maybeSingle()
    : { data: null };

  const { data: activeOrder } = activePlan
    ? await supabase
        .from("refill_orders")
        .select("id, status, availability_confirmed, private_price_amount, private_price_currency")
        .eq("plan_id", activePlan.id)
        .eq("patient_id", claims.sub)
        .in("status", ["requested", "reviewing", "ready"])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: activeMessages } = activeOrder
    ? await supabase
        .from("refill_order_messages")
        .select("id, sender_id, body, created_at")
        .eq("order_id", activeOrder.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: draft } = await supabase
    .from("refill_plan_drafts")
    .select("id, medicine_id, frequency_days, next_refill_date, expires_at")
    .eq("patient_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: draftMedicine } = draft
    ? await supabase
        .from("medicines")
        .select("name, brand, strength, dosage_form")
        .eq("id", draft.medicine_id)
        .maybeSingle()
    : { data: null };

  const { data: recentPayments } = draft
    ? await supabase
        .from("payments")
        .select("status, metadata")
        .eq("patient_id", claims.sub)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };
  const draftPayment = (recentPayments ?? []).find(
    (payment) => (payment.metadata as { draft_id?: string } | null)?.draft_id === draft?.id,
  );
  const paymentConfigured = Boolean(
    process.env.PAYSTACK_SECRET_KEY &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <header className="account-header">
        <div className="account-header__identity">
          <BrandMark className="auth-brand" />
          <span className="account-header__context">Patient account</span>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <section className="account-content account-content--patient" id="account-main" tabIndex={-1}>
        <div className="account-intro">
          <p className="eyebrow">Refill plan</p>
          <h1>Your next refill.</h1>
          <p className="account-lede">{profile?.full_name ? `Welcome, ${profile.full_name}.` : "Your refill plan and messages appear here."} Mani confirms availability and medicine pricing privately.</p>
        </div>
        <PushNotificationOptIn />
        {activePlan ? (
          <section className="account-plan-card" aria-labelledby="active-plan-title">
            <div className="account-plan-card__header">
              <div>
                <p className="eyebrow">Active plan</p>
                <h2 id="active-plan-title">
                  {activeMedicine?.name ?? "Medicine plan"}
                  {activeMedicine?.strength ? ` ${activeMedicine.strength}` : ""}
                </h2>
                {activeMedicine?.brand && <span>{activeMedicine.brand} · {activeMedicine.dosage_form ?? "Medicine"}</span>}
              </div>
              <span className="status-pill status-pill--lime">Plan active</span>
            </div>
            <div className="account-plan-card__details">
              <div><small>Next refill</small><strong>{formatDate(activePlan.next_refill_date)}</strong></div>
              <div><small>Refill frequency</small><strong>Every {activePlan.frequency_days} days</strong></div>
              <div><small>Pharmacy</small><strong>Mani, Benin City</strong></div>
            </div>
            <div className="account-action-panel">
              <div>
                <p className="eyebrow">Next action</p>
                <h3>{activeOrder ? "Your refill request" : "Request your next refill"}</h3>
                <p>{activeOrder ? "Mani is handling this request. Use the private conversation below for availability or pickup questions." : "Send the request when you want Mani to check availability for your next refill."}</p>
              </div>
              <RequestRefill planId={activePlan.id} status={activeOrder?.status} price={activeOrder?.private_price_amount} currency={activeOrder?.private_price_currency} />
            </div>
            {activeOrder && <OrderChat orderId={activeOrder.id} viewerId={claims.sub} participantLabel="Mani" messages={activeMessages ?? []} />}
          </section>
        ) : draft ? (
          <section className="account-plan-card" aria-labelledby="draft-title">
            <div className="account-plan-card__header">
              <div>
                <p className="eyebrow">Refill details saved</p>
                <h2 id="draft-title">
                  {draftMedicine?.name ?? "Medicine details saved"}
                  {draftMedicine?.strength ? ` ${draftMedicine.strength}` : ""}
                </h2>
                {draftMedicine?.brand && <span>{draftMedicine.brand} · {draftMedicine.dosage_form ?? "Medicine"}</span>}
              </div>
              <span className={`status-pill ${draftPayment?.status === "failed" ? "status-pill--red" : "status-pill--yellow"}`}>
                {draftPayment?.status === "failed" ? "Payment needs attention" : "Payment required"}
              </span>
            </div>
            <div className="account-plan-card__details">
              <div><small>Next refill</small><strong>{formatDate(draft.next_refill_date)}</strong></div>
              <div><small>Refill frequency</small><strong>Every {draft.frequency_days} days</strong></div>
              <div><small>Pharmacy</small><strong>Mani, Benin City</strong></div>
            </div>
            <p className="account-plan-card__note">Your medicine and refill date are saved. Pay {MONTHLY_PLAN_PAYMENT_LABEL} to activate the plan; Mani confirms availability and medicine pricing privately.</p>
            <PaymentCheckout configured={paymentConfigured} failedBefore={draftPayment?.status === "failed"} />
          </section>
        ) : (
          <div className="account-empty-state">
            <p className="eyebrow">No active plan</p>
            <strong>Register a medicine to begin.</strong>
            <span>Add the medicine and date you want Mani to prepare for your next refill.</span>
            <Link className="button button--dark" href="/dashboard/plans/new">Register a refill plan <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>
    </main>
  );
}
