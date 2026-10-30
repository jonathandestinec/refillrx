import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import PushNotificationOptIn from "@/app/components/push-notification-opt-in";
import { MONTHLY_PLAN_PAYMENT_LABEL } from "@/lib/payments";
import { formatDate } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

import PaymentCheckout from "./payment-checkout";
import RequestRefill from "./request-refill";
import NewPlanModal from "./plan-modal";
import type { MedicineOption } from "./plans/new/new-plan-form";

const openStatuses = ["requested", "reviewing", "ready"];

export const instant = false;

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
  const { data: historyOrders } = await supabase
    .from("refill_orders")
    .select("id, medicine_id, status, requested_at, completed_at")
    .eq("patient_id", claims.sub)
    .in("status", ["completed", "cancelled"])
    .order("requested_at", { ascending: false })
    .limit(8);
  const historyMedicineIds = [...new Set((historyOrders ?? []).map((order) => order.medicine_id))];
  const { data: historyMedicines } = historyMedicineIds.length
    ? await supabase.from("medicines").select("id, name, strength").in("id", historyMedicineIds)
    : { data: [] };
  const historyMedicineById = new Map((historyMedicines ?? []).map((medicine) => [medicine.id, medicine]));
  const safeHistoryOrders = historyOrders ?? [];

  // Unread chat messages belong to the patient's open refill conversations.
  const { data: openOrderIds } = await supabase.from("refill_orders").select("id").eq("patient_id", claims.sub).in("status", openStatuses);
  const unreadRows = openOrderIds?.length
    ? await supabase.from("refill_order_messages").select("id").in("order_id", openOrderIds.map(order => order.id)).neq("sender_id", claims.sub).is("read_at", null)
    : { data: [] as { id: string }[] };
  const unreadMessages = unreadRows?.data?.length ?? 0;

  const paymentConfigured = Boolean(
    process.env.PAYSTACK_SECRET_KEY &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  // Medicines are needed by the dashboard registration modal.
  const { data: medicines } = await supabase
    .from("medicines")
    .select("id, name, brand, strength, dosage_form, pack_size, category, requires_prescription")
    .eq("active", true)
    .order("category")
    .order("name");
  const medicineOptions: MedicineOption[] = medicines ?? [];

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="patient" userId={claims.sub} unreadMessages={unreadMessages} />
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
            <NewPlanModal medicines={medicineOptions} />
          </div>
        )}
        <section className="account-history" id="history" aria-labelledby="history-title">
            <div className="account-history__heading">
              <div>
                <p className="eyebrow">Previous refills</p>
                <h2 id="history-title">Your refill history</h2>
              </div>
              {safeHistoryOrders.length > 0 && (
                <span>Last {safeHistoryOrders.length} {safeHistoryOrders.length === 1 ? "order" : "orders"}</span>
              )}
            </div>
            {safeHistoryOrders.length ? <div className="account-history__list">
              {safeHistoryOrders.map((order) => {
                const medicine = historyMedicineById.get(order.medicine_id);
                const completed = order.status === "completed";
                return (
                  <div className="account-history__item" key={order.id}>
                    <div>
                      <strong>{medicine?.name ?? "Medicine unavailable"}{medicine?.strength ? ` ${medicine.strength}` : ""}</strong>
                      <span>Requested {formatDate(order.requested_at)}</span>
                    </div>
                    <span className={`status-pill ${completed ? "status-pill--lime" : "status-pill--grey"}`}>{completed ? "Completed" : "Cancelled"}</span>
                  </div>
                );
              })}
            </div> : <p className="account-history__empty">Completed or cancelled refills will appear here.</p>}
        </section>
        </section>
      </div>
    </main>
  );
}
