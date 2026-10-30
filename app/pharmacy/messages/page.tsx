import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import OrderChat from "@/app/components/order-chat";
import { formatDate } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function PharmacyMessagesPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const pharmacistId = claimsData?.claims?.sub;
  if (!pharmacistId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", pharmacistId).maybeSingle();
  if (profile?.role !== "pharmacist") redirect("/dashboard/messages");

  const { data: orders } = await supabase
    .from("refill_orders")
    .select("id, patient_id, medicine_id, status, requested_for, requested_at")
    .in("status", ["requested", "reviewing", "ready"])
    .order("requested_at", { ascending: true });

  const patientIds = [...new Set((orders ?? []).map((order) => order.patient_id))];
  const medicineIds = [...new Set((orders ?? []).map((order) => order.medicine_id))];
  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: patients }, { data: medicines }, { data: messages }] = await Promise.all([
    patientIds.length ? supabase.from("profiles").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] }),
    medicineIds.length ? supabase.from("medicines").select("id, name, brand, strength").in("id", medicineIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("refill_order_messages").select("id, order_id, sender_id, body, created_at, read_at").in("order_id", orderIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
  ]);
  const patientById = new Map((patients ?? []).map((patient) => [patient.id, patient]));
  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const messagesByOrder = new Map<string, Array<{ id: string; sender_id: string; body: string; created_at: string; read_at: string | null }>>();
  for (const message of messages ?? []) {
    const current = messagesByOrder.get(message.order_id) ?? [];
    current.push(message);
    messagesByOrder.set(message.order_id, current);
  }
  const unreadByOrder = new Map<string, number>();
  let unreadMessages = 0;
  for (const [orderId, list] of messagesByOrder) {
    const unread = list.filter((message) => message.sender_id !== pharmacistId && !message.read_at).length;
    unreadByOrder.set(orderId, unread);
    unreadMessages += unread;
  }

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="pharmacist" userId={pharmacistId} unreadMessages={unreadMessages} />
        <section className="account-content messages-page" id="account-main" tabIndex={-1}>
          <div className="account-intro">
            <p className="eyebrow">Pharmacy messages</p>
            <h1>Conversations attached to active refills.</h1>
            <p className="account-lede">Reply to availability and pickup questions without losing the order context.</p>
          </div>
          {orders?.length ? <div className="messages-page__list">
            {orders.map((order) => {
              const patient = patientById.get(order.patient_id);
              const medicine = medicineById.get(order.medicine_id);
              return (
                <article className="messages-page__conversation" key={order.id}>
                  <div className="messages-page__context">
                    <div>
                      <p className="eyebrow">{patient?.full_name ?? "Patient record unavailable"}</p>
                      <h2>{medicine?.name ?? "Medicine unavailable"}{medicine?.strength ? ` ${medicine.strength}` : ""}</h2>
                      <span>{medicine?.brand ?? "Medicine details"} · Requested {formatDate(order.requested_at)}</span>
                    </div>
                    <span className="status-pill status-pill--yellow">{order.status === "ready" ? "Ready for pickup" : order.status === "reviewing" ? "Under review" : "Request sent"}</span>
                    {(unreadByOrder.get(order.id) ?? 0) > 0 && (
                      <span className="messages-page__unread" aria-label={`${unreadByOrder.get(order.id)} unread`}>
                        {unreadByOrder.get(order.id)} new
                      </span>
                    )}
                  </div>
                  <OrderChat orderId={order.id} viewerId={pharmacistId} participantLabel="Patient" messages={messagesByOrder.get(order.id) ?? []} />
                </article>
              );
            })}
          </div> : (
            <div className="account-empty-state">
              <p className="eyebrow">No active conversations</p>
              <strong>The message queue is empty.</strong>
              <span>Patient conversations appear here when there is an active refill request.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
