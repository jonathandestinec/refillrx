import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import OrderChat from "@/app/components/order-chat";
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

  const { data: order } = await supabase
    .from("refill_orders")
    .select("id, status, medicine_id")
    .eq("patient_id", patientId)
    .in("status", ["requested", "reviewing", "ready"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: medicine } = order
    ? await supabase.from("medicines").select("name, strength, brand").eq("id", order.medicine_id).maybeSingle()
    : { data: null };
  const { data: messages } = order
    ? await supabase.from("refill_order_messages").select("id, sender_id, body, created_at").eq("order_id", order.id).order("created_at", { ascending: true })
    : { data: [] };

  const unreadMessages = (messages ?? []).filter((message) => message.sender_id !== patientId).length;

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="patient" unreadMessages={unreadMessages} />
        <section className="account-content messages-page" id="account-main" tabIndex={-1}>
          <div className="account-intro">
            <p className="eyebrow">Patient messages</p>
            <h1>Talk to Mani about an active refill.</h1>
            <p className="account-lede">Keep availability, private pricing, and pickup questions with the refill they belong to.</p>
          </div>
          {order ? (
            <section className="messages-page__conversation" aria-labelledby="active-conversation-title">
              <div className="messages-page__context">
                <div>
                  <p className="eyebrow">Active refill</p>
                  <h2 id="active-conversation-title">{medicine?.name ?? "Medicine unavailable"}{medicine?.strength ? ` ${medicine.strength}` : ""}</h2>
                  <span>{medicine?.brand ?? "Medicine details"} · {order.status === "ready" ? "Ready for pickup" : order.status === "reviewing" ? "Under review" : "Request sent"}</span>
                </div>
              </div>
              <OrderChat orderId={order.id} viewerId={patientId} participantLabel="Mani" messages={messages ?? []} />
            </section>
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
