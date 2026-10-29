import { connection } from "next/server";
import { redirect } from "next/navigation";

import AccountNavigation from "@/app/components/account-navigation";
import PushNotificationOptIn from "@/app/components/push-notification-opt-in";
import { createClient } from "@/lib/supabase/server";

import PharmacyQueue from "./pharmacy-queue";

export const instant = false;

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

  const { data: historyOrders } = await supabase
    .from("refill_orders")
    .select("id, patient_id, medicine_id, status, patient_note, requested_for, requested_at, availability_confirmed, private_price_amount, private_price_currency, reviewed_at")
    .in("status", ["completed", "cancelled"])
    .order("completed_at", { ascending: false })
    .limit(8);

  if (ordersError) {
    console.error("Pharmacist refill queue query failed", {
      code: ordersError.code,
      message: ordersError.message,
      details: ordersError.details,
      hint: ordersError.hint,
    });
  }

  const patientIds = [...new Set([...(orders ?? []), ...(historyOrders ?? [])].map((order) => order.patient_id))];
  const medicineIds = [...new Set([...(orders ?? []), ...(historyOrders ?? [])].map((order) => order.medicine_id))];
  const [{ data: patients }, { data: medicines }] = await Promise.all([
    patientIds.length ? supabase.from("profiles").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] }),
    medicineIds.length ? supabase.from("medicines").select("id, name, brand, strength, dosage_form, reference_price_ngn").in("id", medicineIds) : Promise.resolve({ data: [] }),
  ]);

  const patientById = new Map((patients ?? []).map((patient) => [patient.id, patient]));
  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const initialOrders = (orders ?? []).map((order) => ({
    ...order,
    patient: patientById.get(order.patient_id) ?? undefined,
    medicine: medicineById.get(order.medicine_id) ?? undefined,
  }));
  const initialHistory = (historyOrders ?? []).map((order) => ({
    ...order,
    patient: patientById.get(order.patient_id) ?? undefined,
    medicine: medicineById.get(order.medicine_id) ?? undefined,
  }));

  // Unread patient messages across the open queue, shown as a Messages badge.
  const openOrderIds = (orders ?? []).map((order) => order.id);
  const unreadRows = openOrderIds.length
    ? await supabase.from("refill_order_messages").select("id").in("order_id", openOrderIds).neq("sender_id", claims.sub).is("read_at", null)
    : { data: [] as { id: string }[] };
  const unreadMessages = unreadRows?.data?.length ?? 0;

  return (
    <main className="account-shell">
      <a className="skip-link" href="#account-main">Skip to main content</a>
      <div className="account-app">
        <AccountNavigation role="pharmacist" unreadMessages={unreadMessages} />
        <section className="account-content account-content--pharmacy" id="account-main" tabIndex={-1}>
        <div className="account-intro">
          <p className="eyebrow">Mani, Benin City</p>
          <h1>Refill queue.</h1>
          <p className="account-lede">Review incoming patient requests, confirm availability and private pricing, then mark each order ready for pickup.</p>
        </div>
        <PushNotificationOptIn variant="pharmacist" />
        {ordersError ? (
          <div className="account-empty-state account-empty-state--error" role="alert">
            <p className="eyebrow">Queue unavailable</p>
            <strong>We could not load refill requests.</strong>
            <span>Refresh this page to try again. No request status has been changed.</span>
          </div>
        ) : (
          <PharmacyQueue initialOrders={initialOrders} initialHistory={initialHistory} />
        )}
        </section>
      </div>
    </main>
  );
}
