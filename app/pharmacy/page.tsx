import { connection } from "next/server";
import { redirect } from "next/navigation";

import BrandMark from "@/app/components/brand-mark";
import OrderChat from "@/app/components/order-chat";
import { createClient } from "@/lib/supabase/server";

import OrderControls from "./order-controls";

export const instant = false;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

export default async function PharmacyPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profile?.role !== "pharmacist") redirect("/dashboard");

  const { data: orders, error: ordersError } = await supabase
    .from("refill_orders")
    .select("id, patient_id, medicine_id, status, patient_note, requested_for, requested_at, availability_confirmed, private_price_amount, private_price_currency, reviewed_at")
    .in("status", ["requested", "reviewing", "ready"])
    .order("requested_at", { ascending: true });

  if (ordersError) {
    console.error("Pharmacist refill queue query failed", {
      code: ordersError.code,
      message: ordersError.message,
      details: ordersError.details,
      hint: ordersError.hint,
    });
  }

  const patientIds = [...new Set((orders ?? []).map((order) => order.patient_id))];
  const medicineIds = [...new Set((orders ?? []).map((order) => order.medicine_id))];
  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: patients }, { data: medicines }] = await Promise.all([
    patientIds.length ? supabase.from("profiles").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] }),
    medicineIds.length ? supabase.from("medicines").select("id, name, brand, strength, dosage_form").in("id", medicineIds) : Promise.resolve({ data: [] }),
  ]);

  const patientById = new Map((patients ?? []).map((patient) => [patient.id, patient]));
  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const { data: messages } = orderIds.length
    ? await supabase.from("refill_order_messages").select("id, order_id, sender_id, body, created_at").in("order_id", orderIds).order("created_at", { ascending: true })
    : { data: [] };
  const messagesByOrder = new Map<string, Array<{ id: string; sender_id: string; body: string; created_at: string }>>();
  for (const message of messages ?? []) {
    const orderMessages = messagesByOrder.get(message.order_id) ?? [];
    orderMessages.push(message);
    messagesByOrder.set(message.order_id, orderMessages);
  }

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <header className="account-header">
        <div className="account-header__identity">
          <BrandMark className="auth-brand" />
          <span className="account-header__context">Pharmacy workspace</span>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <section className="account-content account-content--pharmacy" id="account-main" tabIndex={-1}>
        <div className="account-intro">
          <p className="eyebrow">Mani, Benin City</p>
          <h1>Refill queue.</h1>
          <p className="account-lede">Review incoming patient requests, confirm availability and private pricing, then mark each order ready for pickup.</p>
        </div>
        {ordersError ? (
          <div className="account-empty-state account-empty-state--error" role="alert">
            <p className="eyebrow">Queue unavailable</p>
            <strong>We could not load refill requests.</strong>
            <span>Refresh this page to try again. No request status has been changed.</span>
          </div>
        ) : orders?.length ? (
          <section className="pharmacy-queue" aria-labelledby="queue-title">
            <div className="pharmacy-queue__header">
              <div>
                <p className="eyebrow">Open requests</p>
                <h2 id="queue-title">Requests needing attention</h2>
              </div>
              <span className="queue-count">{orders.length} {orders.length === 1 ? "request" : "requests"}</span>
            </div>
            {orders.map((order) => {
              const patient = patientById.get(order.patient_id);
              const medicine = medicineById.get(order.medicine_id);
              return (
                <article className="pharmacy-queue__item" key={order.id}>
                  <div className="pharmacy-queue__topline">
                    <div>
                      <p className="eyebrow">Patient refill request</p>
                      <h2>{medicine?.name ?? "Medicine unavailable"}{medicine?.strength ? ` ${medicine.strength}` : ""}</h2>
                      <p>{medicine?.brand ?? "Medicine details"}{medicine?.dosage_form ? ` · ${medicine.dosage_form}` : ""}</p>
                    </div>
                  </div>
                  <div className="pharmacy-queue__details">
                    <div><small>Patient</small><strong>{patient?.full_name ?? "Patient record unavailable"}</strong></div>
                    <div><small>Requested for</small><strong>{formatDate(order.requested_for)}</strong></div>
                    <div><small>Requested</small><strong>{formatDate(order.requested_at)}</strong></div>
                  </div>
                  {order.patient_note && <p className="pharmacy-queue__instructions"><strong>Patient note</strong>{order.patient_note}</p>}
                  <OrderControls orderId={order.id} status={order.status} availabilityConfirmed={order.availability_confirmed} privatePriceAmount={order.private_price_amount} reviewedAt={order.reviewed_at} />
                  <OrderChat orderId={order.id} viewerId={claims.sub} participantLabel="Patient" messages={messagesByOrder.get(order.id) ?? []} />
                </article>
              );
            })}
          </section>
        ) : (
          <div className="account-empty-state">
            <p className="eyebrow">Open requests</p>
            <strong>The queue is empty.</strong>
            <span>New patient refill requests will appear here after they submit them from an active plan.</span>
          </div>
        )}
      </section>
    </main>
  );
}
