import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import OrderChat from "@/app/components/order-chat";
import { formatDate } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function PatientMessagesPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const patientId = claimsData?.claims?.sub;
  if (!patientId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", patientId).maybeSingle();
  if (profile?.role === "pharmacist") redirect("/pharmacy/messages");

  const { data: orders } = await supabase
    .from("refill_orders")
    .select("id, plan_id, status, medicine_id, requested_at")
    .eq("patient_id", patientId)
    .in("status", ["requested", "reviewing", "ready"])
    .order("requested_at", { ascending: false });

  const activeOrders = orders ?? [];
  const orderIds = activeOrders.map((order) => order.id);
  const medicineIds = [...new Set(activeOrders.map((order) => order.medicine_id))];
  const [{ data: medicines }, { data: messages }] = await Promise.all([
    medicineIds.length
      ? supabase.from("medicines").select("id, name, strength, brand").in("id", medicineIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase
          .from("refill_order_messages")
          .select("id, order_id, sender_id, body, created_at, read_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const messagesByOrder = new Map<string, Array<{ id: string; sender_id: string; body: string; created_at: string; read_at: string | null }>>();
  for (const message of messages ?? []) {
    const current = messagesByOrder.get(message.order_id) ?? [];
    current.push(message);
    messagesByOrder.set(message.order_id, current);
  }
  const unreadMessages = [...messagesByOrder.values()]
    .flat()
    .filter((message) => message.sender_id !== patientId && !message.read_at).length;
  const { data: unreadNotificationRows } = await supabase
    .from("notifications")
    .select("id")
    .eq("patient_id", patientId)
    .is("read_at", null);
  const unreadNotifications = unreadNotificationRows?.length ?? 0;

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="patient" userId={patientId} unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
        <section className="account-content messages-page" id="account-main" tabIndex={-1}>
          <div className="account-intro">
            <p className="eyebrow">Patient messages</p>
            <h1>Messages about your active refills.</h1>
            <p className="account-lede">Keep availability, private pricing, and pickup questions with the refill they belong to.</p>
          </div>
          {activeOrders.length ? (
            <div className="messages-page__list">
            {activeOrders.map((order) => {
              const medicine = medicineById.get(order.medicine_id);
              const orderMessages = messagesByOrder.get(order.id) ?? [];
              const status = order.status === "ready" ? "Ready for pickup" : order.status === "reviewing" ? "Under review" : "Request sent";
              return <section className="messages-page__conversation" id={`conversation-${order.plan_id ?? order.id}`} aria-labelledby={`active-conversation-${order.id}`} key={order.id}>
              <div className="messages-page__context">
                <div>
                  <p className="eyebrow">Active refill</p>
                  <h2 id={`active-conversation-${order.id}`}>{medicine?.name ?? "Medicine unavailable"}{medicine?.strength ? ` ${medicine.strength}` : ""}</h2>
                  <span>{medicine?.brand ?? "Medicine details"} · {status} · Requested {formatDate(order.requested_at)}</span>
                </div>
              </div>
              <OrderChat orderId={order.id} viewerId={patientId} participantLabel="Mani" messages={orderMessages} />
            </section>;
            })}
            </div>
          ) : (
            <div className="account-empty-state">
              <p className="eyebrow">No active conversation</p>
              <strong>Messages appear beside an active refill.</strong>
              <span>Request a refill from your overview when you need to ask Mani about availability or pickup.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
