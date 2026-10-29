import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import BrandMark from "@/app/components/brand-mark";
import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

import PaymentCheckout from "./payment-checkout";

export const instant = false;

export default async function DashboardPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const role = (claims.app_metadata as { role?: string } | undefined)?.role;
  if (role === "pharmacist") redirect("/pharmacy");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

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
      <header className="account-header">
        <BrandMark className="auth-brand" />
        <form action="/auth/signout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <section className="account-content">
        <p className="eyebrow">Patient dashboard</p>
        <h1>Your next refill, in view.</h1>
        <p className="account-lede">{profile?.full_name ? `Welcome, ${profile.full_name}.` : "Welcome to RefillRx."} Your refill plan and messages will appear here.</p>
        {activePlan ? (
          <section className="account-plan-card" aria-labelledby="active-plan-title">
            <div className="account-plan-card__header">
              <div>
                <p className="eyebrow">Refill plan active</p>
                <h2 id="active-plan-title">
                  {activeMedicine?.name ?? "Medicine plan"}
                  {activeMedicine?.strength ? ` ${activeMedicine.strength}` : ""}
                </h2>
                {activeMedicine?.brand && <span>{activeMedicine.brand} · {activeMedicine.dosage_form ?? "Medicine"}</span>}
              </div>
              <span className="status-pill status-pill--lime">Active</span>
            </div>
            <div className="account-plan-card__details">
              <div><small>Next refill</small><strong>{activePlan.next_refill_date}</strong></div>
              <div><small>Routine</small><strong>Every {activePlan.frequency_days} days</strong></div>
            </div>
            <p className="account-plan-card__note">Your monthly service payment is confirmed. Mani will review availability and pricing privately when you request the next refill.</p>
            <div className="account-plan-card__footer">
              <span>Three-day reminder scheduled</span>
              <span>Mani, Benin City</span>
            </div>
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
              <div><small>Next refill</small><strong>{draft.next_refill_date}</strong></div>
              <div><small>Routine</small><strong>Every {draft.frequency_days} days</strong></div>
            </div>
            <p className="account-plan-card__note">Your details are saved. Pay {MONTHLY_PLAN_PAYMENT_LABEL} to activate this plan; Mani confirms availability and medicine pricing privately.</p>
            <PaymentCheckout configured={paymentConfigured} failedBefore={draftPayment?.status === "failed"} />
            <div className="account-plan-card__footer">
              <span>Plan not active yet</span>
              <span>Payment before activation</span>
            </div>
          </section>
        ) : (
          <div className="account-empty-state">
            <strong>No refill plan yet.</strong>
            <span>Register your recurring medicine to start a routine with Mani.</span>
            <Link className="button button--dark" href="/dashboard/plans/new">Register a refill plan <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>
    </main>
  );
}
